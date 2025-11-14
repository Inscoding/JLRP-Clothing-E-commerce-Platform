# scripts/check_hash.py
import os, sys
from pymongo import MongoClient

# ensure your project package is importable (adjust if needed)
sys.path.insert(0, os.path.abspath("."))

from app.core.security import verify_password  # must import the same module uvicorn loads

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client.get_database("jlrp")
u = db.users.find_one({"email": "test@example.com"})
print("User found: ", bool(u))
stored = u.get("hashed_password") or u.get("password_hash") or u.get("password")
print("Stored hash prefix:", (stored or "")[:40])
print("verify_password result:", verify_password("NewStrongPass123!", stored))
