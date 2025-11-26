# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from typing import Any, Dict

# use same tokenUrl as auth
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# No prefix here; main.py mounts it under /users
router = APIRouter(tags=["users"])


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    Decode JWT and return the user document from Mongo using users_collection.
    This avoids importing app.crud.* at module import time (prevents circular imports).
    """
    # Lazy import so module import doesn't fail
    try:
        from app.core.security import decode_access_token
    except Exception:
        decode_access_token = None

    try:
        if decode_access_token:
            payload = decode_access_token(token)
        else:
            # fallback - try to get SECRET/ALGO if exposed; otherwise raise
            from jose import jwt  # type: ignore
            try:
                from app.routers import auth as _auth_mod  # type: ignore
                SECRET_KEY = getattr(_auth_mod, "SECRET_KEY", None)
                ALGORITHM = getattr(_auth_mod, "ALGORITHM", None)
            except Exception:
                SECRET_KEY = None
                ALGORITHM = None

            if not SECRET_KEY or not ALGORITHM:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                    detail="Server configuration error: no token decoder available")
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        # unexpected error decoding token
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token decode error: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload (no sub)")

    # Lazy-import the collection to avoid import-time DB access
    try:
        from app.db import users_collection
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Server DB config error: {e}")

    # Try ObjectId lookup if possible, else fallback to id/email lookup
    try:
        try:
            # support bson.ObjectId if in env
            from bson import ObjectId  # type: ignore
        except Exception:
            ObjectId = None

        user = None
        if ObjectId is not None:
            try:
                user = await users_collection.find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = None

        if not user:
            user = await users_collection.find_one({"id": user_id}) or await users_collection.find_one({"email": user_id})
    except Exception as e:
        # DB operation failed
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"DB error: {e}")

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # sanitize
    user.pop("hashed_password", None)
    return user


@router.get("/me")
async def read_users_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Return sanitized user object. Normalizes id field to `id` (string).
    """
    _id = current_user.get("_id") or current_user.get("id")
    current_user["id"] = str(_id) if _id is not None else None
    current_user.pop("_id", None)
    return current_user
