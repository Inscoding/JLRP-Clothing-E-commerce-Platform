# app/dependencies.py
from typing import Dict
from fastapi import Request, Depends, HTTPException, status

# Use Request to access app.state without importing app directly (avoids circular imports)
from motor.motor_asyncio import AsyncIOMotorDatabase

def get_db(request: Request) -> AsyncIOMotorDatabase:
    """
    Dependency to get DB from request.app.state.db.
    This avoids importing `app` itself and prevents circular imports.
    """
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise RuntimeError("Database not initialised on app.state")
    return db

# DEV STUB: replace with your JWT/session authentication implementation
async def get_current_user() -> Dict:
    """
    Development stub for current user. Replace with real auth in production.
    Must return a mapping with at least 'email', '_id' and 'is_admin' keys.
    """
    return {"_id": "user_123", "email": "customer@example.com", "is_admin": False}

async def get_admin_user(current_user = Depends(get_current_user)) -> Dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return current_user
