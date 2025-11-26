# app/core/security.py
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Union

from passlib.context import CryptContext
from jose import jwt, JWTError

logger = logging.getLogger("uvicorn.error")

# ----------------------------------------------------------
# ⚙️ CONFIGURATION
# ----------------------------------------------------------
# You can override these in your environment (.env file)
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-to-a-secure-random-string")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # default: 1 hour

# ✅ Prefer argon2 (your DB uses argon2id). Keep bcrypt as fallback for legacy hashes.
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    default="argon2",
    deprecated=["auto"],
)

# ----------------------------------------------------------
# 🔐 PASSWORD HASHING & VERIFYING
# ----------------------------------------------------------
def get_password_hash(password: str) -> str:
    """
    Hash a plain password using the configured CryptContext.
    (Kept the original function name to avoid breaking imports.)
    """
    return pwd_context.hash(password)

# alias for readability in other parts of the codebase
def hash_password(password: str) -> str:
    return get_password_hash(password)

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """
    Verify a plain password against its hashed value.
    Returns False for None or on any verification error.
    """
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as exc:
        # Log the error in dev, but do not expose details to callers.
        logger.debug("Password verification error: %s", exc)
        return False

def needs_rehash(hashed_password: Optional[str]) -> bool:
    """
    Return True if the stored hash should be rehashed using the current policy.
    Useful to transparently upgrade weaker/old hashes on successful login.
    """
    if not hashed_password:
        return False
    try:
        return pwd_context.needs_update(hashed_password)
    except Exception as exc:
        logger.debug("needs_rehash check failed: %s", exc)
        return False

# ----------------------------------------------------------
# 🎟️ JWT TOKEN CREATION & DECODING
# ----------------------------------------------------------
def create_access_token(subject: Union[str, dict], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token. `subject` can be a string (sub) or a dict of claims.
    The token includes iat and exp (as numeric timestamps).
    """
    now = datetime.utcnow()
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = now + expires_delta

    payload = {}
    if isinstance(subject, dict):
        payload.update(subject)
    else:
        payload["sub"] = str(subject)

    payload.update({"iat": int(now.timestamp()), "exp": int(expire.timestamp())})
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT token. Returns the payload dict or raises JWTError.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        # Let caller handle the exception (401, etc.); log for debug
        logger.debug("Token decode error: %s", exc)
        raise

# Backwards-compatible exports (if other modules import different names)
__all__ = [
    "get_password_hash",
    "hash_password",
    "verify_password",
    "needs_rehash",
    "create_access_token",
    "decode_access_token",
]
