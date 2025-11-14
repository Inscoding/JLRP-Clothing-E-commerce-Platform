import os
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")  # adjust if your login route differs

SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "changeme"))
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

async def get_current_admin(token: str = Depends(oauth2_scheme), request: Request = None):
    """
    Verify JWT and ensure the user is an admin.
    Returns user document from DB if valid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    email = payload.get("email") or payload.get("sub")
    if not email:
        raise credentials_exception

    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    user = await db.get_collection("users").find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    return user
