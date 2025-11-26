# app/routers/password_reset_db.py
"""
Password-reset router (DB-stored hashed tokens).
Behavior:
 - Only sends reset link when email == SITE_ADMIN_EMAIL (if set).
 - Stores only hashed token in user doc and expiry.
 - Uses async httpx SendGrid call if SENDGRID_API_KEY is provided, otherwise prints link to server logs.

DEV NOTE: This version contains a temporary "dev" behavior: when APP_ENV is set to "development" (or FASTAPI_ENV=="dev"), the /auth/forgot-password endpoint will return the plaintext reset token in the JSON response and also print it to server logs. **Only use this locally for testing** and remove it before deploying.
"""

import os
import time
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi import BackgroundTasks as BG
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

import httpx  # ensure httpx is installed

# Config (env)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60"))
FRONTEND_RESET_URL = os.getenv("FRONTEND_RESET_URL", "https://your-frontend.example.com/admin/reset-password")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "no-reply@yourdomain.com")
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "JLRP Support")

# SECURITY: only allow sending reset to this configured site email (if set)
SITE_ADMIN_EMAIL = os.getenv("SITE_ADMIN_EMAIL", "").lower().strip()  # e.g. admin@jlrp.local

# DB access: prefer centralized app.state.db in routes that can receive Request,
# but for ease we reuse the same pattern you already used (import users_collection).
# If you have a central db module, prefer importing that instead.
try:
    # If your project exposes a central db object, try to use it
    from app.db import users_collection
except Exception:
    # fallback: try building a client here (not ideal for production)
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    users_collection = db.get_collection("users")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])


# Request models
class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class MessageOut(BaseModel):
    detail: str


# Helpers
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)


async def _send_reset_email_async(email: str, token: str):
    """
    Async SendGrid v3 API call using httpx.
    If SENDGRID_API_KEY missing, prints reset link (dev-friendly).
    """
    link = f"{FRONTEND_RESET_URL}?token={token}"
    if not SENDGRID_API_KEY:
        print(f"[debug] SENDGRID_API_KEY missing. Reset link for {email}: {link}")
        return

    payload = {
        "personalizations": [{"to": [{"email": email}], "subject": "Reset your JLRP admin password"}],
        "from": {"email": SENDGRID_FROM_EMAIL, "name": SENDGRID_FROM_NAME},
        "content": [
            {"type": "text/plain", "value": f"Reset your password: {link}"},
            {"type": "text/html", "value": f"<p>Click <a href='{link}'>here to reset your password</a>.</p>"},
        ],
    }
    headers = {"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers)
        if r.status_code >= 400:
            # log but don't raise to avoid turning endpoint 500
            print(f"[error] SendGrid failed {r.status_code}: {r.text}")


# Endpoints
@router.post("/forgot-password", response_model=MessageOut)
async def forgot_password(payload: ForgotIn, background_tasks: BG):
    """
    Only sends reset link if:
      - SITE_ADMIN_EMAIL is not set -> fallback to original behavior (any registered email)
      - SITE_ADMIN_EMAIL is set AND payload.email == SITE_ADMIN_EMAIL (case-insensitive)
    Returns a generic message always (unless running in development with the dev-return enabled).
    """
    email = payload.email.lower().strip()
    generic = {"detail": "If an account with that email exists, a password reset link has been sent."}

    # If SITE_ADMIN_EMAIL set, only allow requests for that email
    if SITE_ADMIN_EMAIL:
        if email != SITE_ADMIN_EMAIL:
            # silently ignore
            return generic

    # find user
    user = await users_collection.find_one({"email": email})
    if not user:
        # still return generic message
        return generic

    # simple rate-limit: 1 per 60s per user (improvement: add Redis/IP throttle)
    last = user.get("last_reset_sent_at", 0)
    now = int(time.time())
    if now - last < 60:
        return generic

    token = _generate_token()
    token_hash = _hash_token(token)
    expires_ts = int((datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).timestamp())

    await users_collection.update_one(
        {"email": email},
        {"$set": {
            "password_reset": {"token_hash": token_hash, "expires_at": expires_ts, "created_at": now},
            "last_reset_sent_at": now
        }}
    )

    # send email async
    background_tasks.add_task(_send_reset_email_async, email, token)

    # --- DEV ONLY: Return plaintext token in development mode and log it ---
    # This is intended for local testing only. Do NOT keep this enabled in production.
    if os.getenv("APP_ENV", "development") == "development" or os.getenv("FASTAPI_ENV", "") == "dev":
        try:
            print(f"[DEV] Reset token for {email}: {token}")
        except Exception:
            pass
        return {"detail": "reset created (dev)", "reset_token": token}

    return generic


@router.post("/reset-password", response_model=MessageOut)
async def reset_password(payload: ResetIn):
    token = payload.token
    new_password = payload.new_password

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password too short")

    token_hash = _hash_token(token)
    now_ts = int(time.time())

    user = await users_collection.find_one({
        "password_reset.token_hash": token_hash,
        "password_reset.expires_at": {"$gte": now_ts}
    })

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # hash new password and update user, clear password_reset and revoke refresh tokens
    hashed_pw = pwd_context.hash(new_password)
    await users_collection.update_one(
        {"_id": user["_id"]} if user.get("_id") else {"email": user["email"]},
        {"$set": {"hashed_password": hashed_pw, "password_changed_at": now_ts, "refresh_tokens": []},
         "$unset": {"password_reset": ""}}
    )

    return {"detail": "Password has been reset successfully."}
