# app/crud/users.py
from typing import Any, Dict, Optional
import re

from bson import ObjectId
from passlib.context import CryptContext

from app.db import get_client
from app.models.user import UserCreate, UserInDB, UserOut

pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")



def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _objid_to_str(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    doc = dict(doc)
    _id = doc.get("_id")
    if isinstance(_id, ObjectId):
        doc["_id"] = str(_id)
    return doc


async def get_user_by_email(email: str) -> Optional[UserInDB]:
    """Case-insensitive lookup for user by email. Returns UserInDB or None."""
    if not email:
        return None
    db = get_client()
    norm = _normalize_email(email)
    escaped = re.escape(norm)
    regex = {"$regex": f"^{escaped}$", "$options": "i"}
    user_data = await db["users"].find_one({"email": regex})
    user_data = _objid_to_str(user_data)
    if not user_data:
        return None
    return UserInDB(**user_data)


async def get_user_by_id(user_id: str) -> Optional[UserInDB]:
    """Lookup by string user_id (ObjectId). Returns UserInDB or None."""
    if not user_id:
        return None
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    db = get_client()
    user_data = await db["users"].find_one({"_id": oid})
    user_data = _objid_to_str(user_data)
    if not user_data:
        return None
    return UserInDB(**user_data)


async def create_user(user_data: Dict[str, Any]) -> UserInDB:
    """
    Insert a new user dict into DB.
    If `password` key exists in user_data, it will be hashed to `hashed_password`.
    Returns the created UserInDB (with string _id).
    """
    db = get_client()

    # normalize email if present
    if "email" in user_data:
        user_data["email"] = _normalize_email(user_data["email"])

    # handle password -> hashed_password (defensive)
    if "password" in user_data:
        password = user_data.pop("password")
        # ensure it's a string
        if not isinstance(password, str):
            try:
                password = str(password)
            except Exception:
                raise ValueError("password must be a string")

        # convert to bytes and enforce bcrypt limit (72 bytes)
        pw_bytes = password.encode("utf-8")
        if len(pw_bytes) > 72:
            # truncate to bcrypt max (optionally raise instead)
            pw_bytes = pw_bytes[:72]
            password = pw_bytes.decode("utf-8", errors="ignore")

        user_data["hashed_password"] = pwd_ctx.hash(password)

    # default flags
    user_data.setdefault("is_active", True)
    user_data.setdefault("roles", [])

    result = await db["users"].insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    return UserInDB(**user_data)


async def update_user(user_id: str, update_data: Dict[str, Any]) -> Optional[UserInDB]:
    """
    Update fields for a user by id.
    If `password` is provided in update_data, it will be hashed into `hashed_password`.
    Returns the updated UserInDB or None.
    """
    if not user_id:
        return None
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None

    db = get_client()

    # normalize email if being changed
    if "email" in update_data:
        update_data["email"] = _normalize_email(update_data["email"])

    # handle password hashing defensively
    if "password" in update_data:
        password = update_data.pop("password")
        if not isinstance(password, str):
            try:
                password = str(password)
            except Exception:
                raise ValueError("password must be a string")

        pw_bytes = password.encode("utf-8")
        if len(pw_bytes) > 72:
            pw_bytes = pw_bytes[:72]
            password = pw_bytes.decode("utf-8", errors="ignore")

        update_data["hashed_password"] = pwd_ctx.hash(password)

    await db["users"].update_one({"_id": oid}, {"$set": update_data})
    updated = await db["users"].find_one({"_id": oid})
    updated = _objid_to_str(updated)
    if not updated:
        return None
    return UserInDB(**updated)
