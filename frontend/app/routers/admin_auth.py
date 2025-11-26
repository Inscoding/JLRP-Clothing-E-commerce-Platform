# app/routers/admin_auth.py

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import timedelta
import os

from jose import JWTError, jwt
from bson import ObjectId

from app.db import users_collection
from app.core.security import verify_password, get_password_hash
from app.routers.auth import _create_token_robust
# TODO: later we will send real email from here
# from app.email.sender import send_admin_reset_email

router = APIRouter(tags=["admin-auth"])

ADMIN_FRONTEND_URL = "http://localhost:3000"  # change in production

# Must match what _create_token_robust uses internally
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


class AdminLoginSchema(BaseModel):
    email: str
    password: str


class AdminForgotPasswordSchema(BaseModel):
    email: EmailStr


class AdminResetPasswordSchema(BaseModel):
    token: str
    new_password: str


@router.post("/admin/login")
async def admin_login(payload: AdminLoginSchema):
    email = payload.email
    password = payload.password

    # Fetch user
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Verify password
    hashed = user.get("hashed_password")
    if not hashed or not verify_password(password, hashed):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check admin role
    roles = user.get("roles", []) or []
    role_single = user.get("role")
    if role_single:
        roles.append(role_single)

    if not any(r in roles for r in ("admin", "owner")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Create access token
    subject = str(user.get("_id") or user.get("id") or email)
    access_token = _create_token_robust(
        subject=subject,
        expires_delta=timedelta(minutes=60),
        data={"role": "admin"},
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "role": "admin",
        },
    }


# POST /admin/auth/forgot-password
@router.post("/admin/auth/forgot-password")
async def admin_forgot_password(payload: AdminForgotPasswordSchema):
    email = payload.email

    # Find user
    user = await users_collection.find_one({"email": email})

    # For security we always respond ok, even if user/role invalid
    if not user:
        return {"ok": True}

    # Check admin/owner role
    roles = user.get("roles", []) or []
    role_single = user.get("role")
    if role_single:
        roles.append(role_single)

    if not any(r in roles for r in ("admin", "owner")):
        return {"ok": True}

    # Create a short-lived reset token using your existing JWT helper
    subject = str(user.get("_id") or user.get("id") or email)
    reset_token = _create_token_robust(
        subject=subject,
        expires_delta=timedelta(minutes=40),
        data={"role": "admin", "type": "reset_password"},
    )

    reset_link = f"{ADMIN_FRONTEND_URL}/admin/reset-password?token={reset_token}"

    # TODO: hook up real email sending using your existing email utils
    # await send_admin_reset_email(email, reset_link)

    # For now, log the link in backend so you can see it works
    print("🔐 Admin password reset link:", reset_link)

    return {"ok": True}


# POST /admin/auth/reset-password
@router.post("/admin/auth/reset-password")
async def admin_reset_password(payload: AdminResetPasswordSchema):
    token = payload.token
    new_password = payload.new_password

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too short",
        )

    # Decode the JWT reset token
    try:
        data = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id_str = data.get("sub")
        token_type = data.get("type")
        if token_type != "reset_password" or not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Mongo _id is ObjectId
    try:
        user_id = ObjectId(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id in token",
        )

    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Ensure it's admin/owner
    roles = user.get("roles", []) or []
    role_single = user.get("role")
    if role_single:
        roles.append(role_single)

    if not any(r in roles for r in ("admin", "owner")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to reset this account here",
        )

    # Hash new password & update
    hashed_new = get_password_hash(new_password)
    await users_collection.update_one(
        {"_id": user_id},
        {"$set": {"hashed_password": hashed_new}},
    )

    return {"ok": True, "msg": "Password updated successfully"}
