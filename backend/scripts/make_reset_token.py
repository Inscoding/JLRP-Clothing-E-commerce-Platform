# scripts/make_reset_token.py
import os, time, hashlib, secrets
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
USERS_COLL = os.getenv("USERS_COLL", "users")
APP_URL = os.getenv("APP_URL", "http://localhost:8000")
TOKEN_EXP_SECONDS = int(os.getenv("PWD_RESET_EXP", 60*60))  # 1 hour default

EMAIL = os.getenv("RESET_EMAIL", "test@example.com")  # change via env or edit here

def hash_token(tok: str) -> str:
    return hashlib.sha256(tok.encode("utf-8")).hexdigest()

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

user = db[USERS_COLL].find_one({"email": EMAIL})
if not user:
    raise SystemExit(f"user with email {EMAIL} not found in {DB_NAME}.{USERS_COLL}")

raw_token = secrets.token_urlsafe(32)
hashed = hash_token(raw_token)
expiry = int(time.time()) + TOKEN_EXP_SECONDS

db[USERS_COLL].update_one(
    {"_id": user["_id"]},
    {"$set": {"pwd_reset": {"token": hashed, "expiry": expiry}}},
    upsert=False
)

reset_link = f"{APP_URL}/reset-password?token={raw_token}"
print("=== RESET LINK ===")
print(reset_link)
print()
print("=== CURL to apply reset (copy-paste this) ===")
print(f"curl -X POST \"{APP_URL}/auth/reset-password\" "
      "-H \"Content-Type: application/json\" "
      f"-d '{{\"token\":\"{raw_token}\",\"new_password\":\"NewStrongPass123!\"}}'")
print()
print("Token will expire in", TOKEN_EXP_SECONDS, "seconds (now -> expiry unix ts:", expiry, ")")
