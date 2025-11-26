# create_admin.py
"""
Standalone admin creator — no pydantic dependency.
Run from backend/ folder:
  .venv/Scripts/python.exe create_admin.py
"""

import os
import asyncio
import time
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Config via env or defaults
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@jlrp.local")
INITIAL_ADMIN_PASSWORD = os.getenv("INITIAL_ADMIN_PASSWORD", "ChangeMe123!")
FORCE = os.getenv("FORCE", "false").lower() in ("1", "true", "yes")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    users = db.get_collection("users")

    email = INITIAL_ADMIN_EMAIL.lower()
    existing = await users.find_one({"email": email})

    if existing and not FORCE:
        print(f"[skipped] Admin {email} already exists. Use FORCE=true to update.")
        client.close()
        return

    hashed = pwd_context.hash(INITIAL_ADMIN_PASSWORD)
    now_ts = int(time.time())
    admin_doc = {
        "email": email,
        "password_hash": hashed,
        "role": "admin",
        "created_at": now_ts,
        "password_changed_at": now_ts
    }

    if existing and FORCE:
        await users.update_one({"_id": existing["_id"]}, {"$set": admin_doc})
        print(f"[updated] Admin {email} updated (FORCE=true).")
    else:
        await users.insert_one(admin_doc)
        print(f"[created] Admin {email} created successfully.")

    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
