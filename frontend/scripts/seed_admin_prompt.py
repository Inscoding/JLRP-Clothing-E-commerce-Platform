# scripts/seed_admin_prompt.py
import os
from getpass import getpass
from pymongo import MongoClient
from passlib.context import CryptContext

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
ADMIN_EMAIL = os.getenv("SITE_ADMIN_EMAIL", "jlrp509324@gmail.com")

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
client = MongoClient(MONGO_URI)
db = client.get_database(DB_NAME)

def main():
    print(f"Seeding admin: {ADMIN_EMAIL}")
    pw = getpass("Enter admin password (won't be shown): ").strip()
    if not pw:
        print("No password entered — aborting.")
        return
    confirm = getpass("Confirm password: ").strip()
    if pw != confirm:
        print("Passwords do not match — aborting.")
        return

    hashed = pwd_context.hash(pw)
    admin_doc = {
        "email": ADMIN_EMAIL,
        "full_name": "Site Admin",
        "hashed_password": hashed,
        "roles": ["admin"],
        "is_active": True,
        "refresh_tokens": []
    }
    db.users.update_one({"email": ADMIN_EMAIL}, {"$set": admin_doc}, upsert=True)
    print("✅ Admin upserted:", ADMIN_EMAIL)
    print("Now restart your server and test login.")

if __name__ == "__main__":
    main()
