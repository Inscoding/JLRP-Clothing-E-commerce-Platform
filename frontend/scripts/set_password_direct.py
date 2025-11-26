# scripts/set_password_direct.py
import os
from pymongo import MongoClient
from passlib.hash import argon2

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
EMAIL = "test@example.com"           # target user
NEW_PASS = "NewStrongPass123!"       # change if you want

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

user = db.users.find_one({"email": EMAIL})
if not user:
    raise SystemExit(f"user {EMAIL} not found")

hashed = argon2.hash(NEW_PASS)
db.users.update_one(
    {"_id": user["_id"]},
    {"$set": {"hashed_password": hashed}, "$unset": {"pwd_reset": "", "force_password_reset": ""}}
)
print(f"Password for {EMAIL} set to '{NEW_PASS}' (hashed).")
