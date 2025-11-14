# app/routers/auth.py
import os
import logging
from fastapi import APIRouter, HTTPException, Depends, status, Response, Cookie, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from jose import JWTError

# Try to support Mongo ObjectId if bson is available
try:
    from bson import ObjectId
except Exception:
    ObjectId = None

# Project imports
from app.schemas import UserCreate, UserPublic, Token
from app.db import users_collection
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    needs_rehash,
    hash_password,
)

# Router (no prefix here; main.py mounts under /auth)
router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

logger = logging.getLogger("uvicorn.error")

# Environment toggle:
# If ADMIN_LOGIN_ONLY == "true" (default) then only admin/owner can login at /login.
# Set ADMIN_LOGIN_ONLY="false" in .env for dev to allow any active user to login.
ADMIN_LOGIN_ONLY = os.getenv("ADMIN_LOGIN_ONLY", "true").lower() in ("1", "true", "yes")

# --- Refresh token settings (dev defaults) ---
REFRESH_TOKEN_EXPIRE_DAYS = 7
REFRESH_COOKIE_NAME = "refresh_token"
# In production: secure=True, samesite="none" (if cross-site), and proper domain
REFRESH_COOKIE_PARAMS = {
    "httponly": True,
    "secure": False,
    "samesite": "lax",
    "path": "/auth",
}


# -----------------------
# Helper: Create token robustly (ensures iat present)
# -----------------------
def _create_token_robust(subject: str, expires_delta: Optional[timedelta] = None, data: Optional[Dict[str, Any]] = None) -> str:
    """
    Flexible wrapper for create_access_token to support multiple signatures.
    Adds an 'iat' claim so we can validate tokens against password changes.
    """
    if data is None:
        data = {}
    # ensure sub and iat present
    data = {**data, "sub": subject, "iat": int(datetime.utcnow().timestamp())}

    # Try common signature patterns
    try:
        return create_access_token(subject=subject, expires_delta=expires_delta)
    except TypeError:
        try:
            return create_access_token(data=data, expires_delta=expires_delta)
        except TypeError:
            # last resort: try passing only data
            return create_access_token(data=data)


# -----------------------
# Helper: create refresh token (returns token, jti)
# -----------------------
def _create_refresh_token(subject: str, expires_delta: Optional[timedelta] = None) -> Tuple[str, str]:
    jti = uuid4().hex
    if expires_delta is None:
        expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    data = {"type": "refresh", "jti": jti}
    token = _create_token_robust(subject=subject, expires_delta=expires_delta, data=data)
    return token, jti


def _set_refresh_cookie(response: Response, token: str, max_age: Optional[int] = None):
    params = REFRESH_COOKIE_PARAMS.copy()
    if max_age is None:
        max_age = 60 * 60 * 24 * REFRESH_TOKEN_EXPIRE_DAYS
    response.set_cookie(REFRESH_COOKIE_NAME, token, max_age=max_age, **params)


def _clear_refresh_cookie(response: Response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PARAMS.get("path", "/"))


# -------------------------------------------------------------------
# ADMIN CHECK & CURRENT USER UTIL
# -------------------------------------------------------------------
async def _fetch_user_by_id_or_email(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Helper to fetch user by ObjectId or id/email string. Returns raw user doc.
    """
    try:
        if ObjectId is not None:
            try:
                # try treat as ObjectId
                return await users_collection.find_one({"_id": ObjectId(user_id)})
            except Exception:
                pass
        # fallback to id or email
        return await users_collection.find_one({"id": user_id}) or await users_collection.find_one({"email": user_id})
    except Exception:
        return None


def _ts_from_value(val):
    """
    Normalize password_changed_at values (int timestamp or datetime) to int timestamp.
    """
    if val is None:
        return 0
    if isinstance(val, int):
        return val
    if isinstance(val, float):
        return int(val)
    if isinstance(val, datetime):
        return int(val.timestamp())
    # Unknown type - try convert
    try:
        return int(val)
    except Exception:
        return 0


async def require_admin(token: str = Depends(oauth2_scheme)):
    """
    Simple admin check: decode token, find user, ensure roles contains 'admin' or 'owner'.
    Also checks token's iat vs user's password_changed_at to revoke old tokens.
    Use this as a dependency on admin-only routes.
    """
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # fetch user doc
    user = await _fetch_user_by_id_or_email(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # check password_changed_at: token iat should be >= password_changed_at
    token_iat = payload.get("iat", 0)
    pwd_changed_ts = _ts_from_value(user.get("password_changed_at"))
    try:
        token_iat_int = int(token_iat)
    except Exception:
        token_iat_int = 0
    if token_iat_int < pwd_changed_ts:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked due to password change")

    # roles can be in `roles` list or `role` string - support both
    roles = user.get("roles", []) or []
    role_single = user.get("role")
    if role_single:
        roles = list(set(roles + [role_single]))

    if not any(r in roles for r in ("admin", "owner")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    # sanitize user before returning
    try:
        user.pop("hashed_password", None)
    except Exception:
        pass
    return user


# -------------------------------------------------------------------
# REGISTER (admin-only)
# -------------------------------------------------------------------
@router.post("/register", response_model=UserPublic, dependencies=[Depends(require_admin)])
async def register_user(payload: UserCreate):
    """
    Register a new user. Only callable by an admin (no public registration).
    Validates password length and rejects duplicate email.
    """
    # parse pydantic model (supports v1 & v2)
    try:
        user_data = payload.model_dump()
    except Exception:
        user_data = payload.dict()

    user_data.pop("id", None)
    user_data["created_at"] = datetime.utcnow()

    # Validate password
    raw_password = user_data.pop("password", None)
    if raw_password is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required")

    if not isinstance(raw_password, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be a string")

    raw_password = raw_password.strip()
    password_bytes = raw_password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too long for bcrypt (must be 72 bytes or fewer in UTF-8). Use a shorter password or switch to a different hashing algorithm."
        )

    user_data["hashed_password"] = get_password_hash(raw_password)
    user_data["is_active"] = True

    # Check duplicate email
    existing = await users_collection.find_one({"email": user_data.get("email")})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Insert
    try:
        res = await users_collection.insert_one(user_data)
        inserted_id = getattr(res, "inserted_id", None)
        if inserted_id is None:
            inserted_id = uuid4().hex
    except Exception as e:
        logger.debug("DB insert failed, using fallback ID: %s", e)
        inserted_id = uuid4().hex

    # Normalize id to string
    try:
        inserted_id = str(inserted_id)
    except Exception:
        inserted_id = uuid4().hex

    user_dict: Dict[str, Any] = {**user_data, "id": inserted_id}
    user_dict.pop("hashed_password", None)
    return user_dict


# -------------------------------------------------------------------
# LOGIN (access token + refresh cookie) - ADMIN ONLY (configurable)
# -------------------------------------------------------------------
@router.post("/login", response_model=Token)
async def login_for_access_token(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Uses OAuth2PasswordRequestForm for compatibility with Swagger/token flow.
    Accepts username=<email> and password in form data.
    Issues access token if user exists, password matches; by default requires admin role,
    but can be toggled with ADMIN_LOGIN_ONLY env var (set to "false" to disable).
    """
    email = form_data.username
    password = form_data.password

    logger.debug("LOGIN: attempt for %s (ADMIN_LOGIN_ONLY=%s)", email, ADMIN_LOGIN_ONLY)

    user = await users_collection.find_one({"email": email})
    if not user:
        logger.debug("LOGIN: user not found for %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    hashed = user.get("hashed_password")
    logger.debug("LOGIN: stored hash prefix for %s: %s", email, (hashed or "")[:30])

    if not hashed or not verify_password(password, hashed):
        logger.debug("LOGIN: password verify failed for %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    # Optionally rehash if policy changed
    try:
        if needs_rehash(hashed):
            try:
                new_hash = hash_password(password)
                if ObjectId is not None and user.get("_id") is not None:
                    await users_collection.update_one({"_id": user["_id"]}, {"$set": {"hashed_password": new_hash}})
                else:
                    await users_collection.update_one({"id": str(user.get("id") or user.get("_id"))}, {"$set": {"hashed_password": new_hash}})
                logger.debug("LOGIN: rehashed password for %s", email)
            except Exception as exc:
                logger.debug("LOGIN: failed to rehash for %s: %s", email, exc)
    except Exception:
        # ignore rehashing errors (do not break login)
        pass

    # enforce admin-only login unless toggle disabled
    if ADMIN_LOGIN_ONLY:
        roles = user.get("roles", []) or []
        role_single = user.get("role")
        if role_single:
            roles = list(set(roles + [role_single]))
        if not any(r in roles for r in ("admin", "owner")):
            logger.debug("LOGIN: user %s does not have admin role - rejecting", email)
            # generic error to avoid leaking role info
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    subject = str(user.get("_id") or user.get("id") or email)
    access_token = _create_token_robust(subject=subject, expires_delta=timedelta(minutes=60))

    # create refresh token (with jti) and persist jti
    refresh_token, jti = _create_refresh_token(subject=subject)

    try:
        # prefer ObjectId update if present
        if ObjectId is not None and user.get("_id") is not None:
            await users_collection.update_one({"_id": user["_id"]}, {"$addToSet": {"refresh_tokens": jti}})
        else:
            await users_collection.update_one({"id": subject}, {"$addToSet": {"refresh_tokens": jti}})
    except Exception as e:
        logger.debug("LOGIN: Could not persist refresh jti: %s", e)

    # set httpOnly refresh cookie
    _set_refresh_cookie(response, refresh_token)

    logger.debug("LOGIN: success for %s (admin-check=%s)", email, ADMIN_LOGIN_ONLY)
    return {"access_token": access_token, "token_type": "bearer"}
