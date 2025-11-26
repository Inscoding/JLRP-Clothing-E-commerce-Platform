# scripts/seed_admin.py
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com")
    password = os.getenv("SEED_ADMIN_PASSWORD", "AdminPass123!")  # change via .env if desired

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = {
        "email": email,
        "hashed_password": hashed,
        "role": "admin",
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    existing = await db.get_collection("users").find_one({"email": email})
    if existing:
        print("Admin already exists:", email)
    else:
        result = await db.get_collection("users").insert_one(user)
        print("Inserted admin id:", result.inserted_id)
    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
