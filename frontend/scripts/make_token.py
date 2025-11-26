# scripts/make_token.py
import os
import datetime
from jose import jwt
from dotenv import load_dotenv

load_dotenv(".env")

SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "changeme"))
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com")
payload = {
    "sub": email,
    "email": email,
    "role": "admin",
    # expire in 7 days
    "exp": int((datetime.datetime.utcnow() + datetime.timedelta(days=7)).timestamp())
}
token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
print(token)
