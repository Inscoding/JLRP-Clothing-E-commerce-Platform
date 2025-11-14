# app/main.py

"""
JLRP backend entrypoint (simple settings via environment).
- Loads .env at import time so environment values are available to the running app.
- Connects to MongoDB on startup and stores client & db on app.state
- Includes routers: auth, password_reset_db (password reset), payment
- Optional admin/router inclusion
- CORS enabled for configured origins
- Improved /health endpoint and temporary debug endpoints to inspect DB behavior
  NOTE: remove debug endpoints after troubleshooting.
"""

from dotenv import load_dotenv
load_dotenv(".env")  # ensure .env is loaded before reading os.getenv

import os
import traceback
from typing import List, Optional, Dict
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Motor + certifi for secure TLS to Atlas
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import certifi

# bcrypt used by debug route only
import bcrypt

# ---------- Settings (now read from env/.env) ----------
PROJECT_NAME = os.getenv("PROJECT_NAME", "JLRP Backend")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "*")
DEBUG = os.getenv("DEBUG", "true").lower() in ("1", "true", "yes")

# parse origins
if isinstance(CORS_ORIGINS_ENV, str):
    if CORS_ORIGINS_ENV.strip() == "*" or CORS_ORIGINS_ENV.strip() == "":
        CORS_ORIGINS: List[str] = ["*"]
    else:
        CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_ENV.split(",")]
else:
    CORS_ORIGINS = list(CORS_ORIGINS_ENV)

# ---------- Uploads dir config ----------
UPLOAD_DIR = "uploads"
# ensure uploads dir exists (safe for production; it will be ignored by git if in .gitignore)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------- App ----------
app = FastAPI(title=PROJECT_NAME, debug=DEBUG)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount static uploads directory to serve uploaded images
# This allows uploaded files to be accessed at: http[s]://<host>/uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---------- Helper: decide TLS usage ----------
def _should_use_tls(uri: str) -> bool:
    """
    Return True if we should use TLS options for this URI.
    Use TLS for mongodb+srv (Atlas) and for remote hosts (not localhost/127.0.0.1).
    """
    if uri is None:
        return False
    low = uri.lower().strip()
    if low.startswith("mongodb+srv://"):
        return True
    # parse host from uri; cover mongodb://user:pass@host:port/db and mongodb://host:port
    try:
        parsed = urlparse(uri)
        hostname = parsed.hostname or ""
        if hostname in ("localhost", "127.0.0.1", "::1"):
            return False
        # if hostname looks like a remote host (contains a dot), enable TLS
        if "." in hostname:
            return True
    except Exception:
        pass
    return False

USE_TLS = _should_use_tls(MONGO_URI)
CA_BUNDLE = certifi.where() if USE_TLS else None

# ---------- Database lifecycle ----------
@app.on_event("startup")
async def startup_db_client():
    """
    Create/attach motor client and db on app.state so routers can reuse:
      app.state.mongo_client
      app.state.db

    Uses certifi CA bundle for TLS connections to Atlas to avoid local OpenSSL/CA issues.
    Falls back to insecure TLS (tlsAllowInvalidCertificates=True) only for remote URIs
    as a temporary developer fallback (not for production).
    """
    try:
        if USE_TLS:
            # Attempt to create client with certifi CA bundle
            try:
                client = AsyncIOMotorClient(MONGO_URI, tls=True, tlsCAFile=CA_BUNDLE)
                app.state.mongo_client = client
                app.state.db = client[DB_NAME]
                try:
                    await app.state.db.command("ping")
                    print("[startup] MongoDB connected (TLS, certifi CA bundle)")
                    # continue startup; don't `return` so we can ensure indexes later
                except Exception as ping_exc:
                    print("[startup] MongoDB TLS ping failed:", repr(ping_exc))
            except Exception as e:
                print("[startup] Creating TLS client failed:", repr(e))

            # Developer fallback: try allowing invalid certificates (insecure)
            # Only used for dev troubleshooting, avoid in production.
            try:
                client = AsyncIOMotorClient(MONGO_URI, tls=True, tlsAllowInvalidCertificates=True)
                app.state.mongo_client = client
                app.state.db = client[DB_NAME]
                try:
                    await app.state.db.command("ping")
                    print("[startup] MongoDB connected (TLS with invalid certs - dev fallback)")
                except Exception as ping_exc:
                    print("[startup] MongoDB ping failed with insecure TLS fallback:", repr(ping_exc))
            except Exception as e:
                print("[startup] Creating insecure TLS client failed:", repr(e))

            # If we get here, both secure and insecure TLS attempts may have failed.
            if getattr(app.state, "db", None) is None:
                print("[startup] MongoDB TLS attempts exhausted; leaving client attached if any.")
        else:
            # No TLS for localhost / 127.0.0.1 — connect plainly
            client = AsyncIOMotorClient(MONGO_URI)
            app.state.mongo_client = client
            app.state.db = client[DB_NAME]
            try:
                await app.state.db.command("ping")
                print("[startup] MongoDB connected (no TLS, local)")
            except Exception as ping_exc:
                print("[startup] MongoDB connection ping failed (no TLS):", repr(ping_exc))
    except Exception as e:
        # if creating client itself fails, ensure it's visible in logs
        print("[startup] Failed to create Mongo client:", repr(e))

    # Best-effort: ask returns router to create indexes (if it exists)
    try:
        from app.routers import return_requests as return_requests_module
        try:
            await return_requests_module.ensure_indexes(getattr(app.state, "db", None))
            print("[startup] Ensured indexes for return_requests (if db available)")
        except Exception as e:
            print("[startup] Could not ensure indexes for return_requests:", repr(e))
    except Exception:
        # ignore if router/module isn't present yet
        pass

    # Best-effort: ensure indexes for products router if available
    try:
        from app.routers import products as products_module
        try:
            # products.ensure_indexes expects no args in the router file we provided
            await products_module.ensure_indexes()
            print("[startup] Ensured indexes for products (if db available)")
        except Exception as e:
            print("[startup] Could not ensure indexes for products:", repr(e))
    except Exception:
        # ignore if router isn't present yet
        pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client: Optional[AsyncIOMotorClient] = getattr(app.state, "mongo_client", None)
    if client:
        client.close()
        print("[shutdown] MongoDB client closed")


# ---------- Routers ----------
# auth router
try:
    from app.routers import auth as auth_router_module
    app.include_router(auth_router_module.router)
    print("[startup] Included router: auth")
except Exception as e:
    print("[startup] Could not include auth router:", e)

# password reset router
try:
    from app.routers import password_reset_db as password_reset_module
    app.include_router(password_reset_module.router)
    print("[startup] Included router: password_reset_db")
except Exception as e:
    print("[startup] Could not include password_reset_db router:", e)

# payment router (Razorpay)
try:
    from app.routers import payment_router as payment_router_module
    app.include_router(payment_router_module.router)
    print("[startup] Included router: payment")
except Exception as e:
    print("[startup] Could not include payment router:", e)

# include optional admin router if present (keeps previous behavior)
try:
    from app.routers import admin as admin_module
    app.include_router(admin_module.router)
    print("[startup] Included router: admin")
except Exception:
    pass

# include the new admin_uploads router if it exists
try:
    from app.routers import admin_uploads as admin_uploads_module
    app.include_router(admin_uploads_module.router)
    print("[startup] Included router: admin_uploads")
except Exception as e:
    # this is okay if the file isn't present yet; log the error for debugging
    print("[startup] Could not include admin_uploads router (ok if not present):", e)

# include returns router (return_requests.py)
try:
    from app.routers import return_requests as return_requests_module
    app.include_router(return_requests_module.router)
    print("[startup] Included router: return_requests")
except Exception as e:
    print("[startup] Could not include return_requests router (ok if not present):", e)

# include products router (our new products endpoints)
try:
    from app.routers import products as products_module
    app.include_router(products_module.router)
    print("[startup] Included router: products")
except Exception as e:
    print("[startup] Could not include products router (ok if not present):", e)


# ---------- TEMP DEBUG ROUTES (remove after debug) ----------
@app.get("/debug/db-info")
async def debug_db_info(request: Request):
    """
    Returns debug info about the DB the *running app* is using.
    """
    db = getattr(request.app.state, "db", None)
    if db is None:
        return {"ok": False, "error": "app.state.db is not initialized"}
    try:
        cols = await db.list_collection_names()
    except Exception as e:
        cols = f"error listing collections: {repr(e)}"
    # mask MONGO_URI
    masked = MONGO_URI
    if masked and "@" in masked:
        try:
            prefix, rest = masked.split("://", 1)
            credentials_host = rest.split("@", 1)
            if len(credentials_host) == 2:
                _, host_and_path = credentials_host
                masked = f"{prefix}://<credentials>@{host_and_path}"
        except Exception:
            masked = "<masked>"
    return {"ok": True, "app_db_name": db.name, "app_mongo_uri": masked, "collections": cols}


@app.post("/debug/check-login-form")
async def debug_check_login_form(request: Request, username: str = Form(...), password: str = Form(...)):
    """
    Debug helper: checks the running app's DB for the user and tests bcrypt verification
    """
    db = getattr(request.app.state, "db", None)
    if db is None:
        return JSONResponse({"ok": False, "error": "app.state.db not set"}, status_code=500)

    user = await db.get_collection("users").find_one({"email": username})
    if not user:
        return {"found": False, "msg": "user not found"}

    stored = user.get("hashed_password") or user.get("password") or user.get("password_hash")
    stored_prefix = (stored or "")[:12]

    bcrypt_ok = False
    bcrypt_err = None
    try:
        bcrypt_ok = bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
    except Exception as e:
        bcrypt_err = repr(e)

    raw_user = {}
    for k, v in user.items():
        if k == "hashed_password":
            continue
        if isinstance(v, (str, bool, int, float)) or v is None:
            raw_user[k] = v
        else:
            raw_user[k] = str(v)

    return {
        "found": True,
        "email": user.get("email"),
        "role": user.get("role"),
        "is_active": user.get("is_active"),
        "app_db_name": db.name,
        "stored_prefix": stored_prefix,
        "bcrypt_ok": bcrypt_ok,
        "bcrypt_error": bcrypt_err,
        "raw_user": raw_user,
    }


# ---------- Root / health ----------
@app.get("/", tags=["root"])
async def root():
    return {"status": "ok", "project": PROJECT_NAME}


@app.get("/health", tags=["root"])
async def healthcheck():
    client = getattr(app.state, "mongo_client", None)
    db = getattr(app.state, "db", None)
    db_ok = False
    db_error = None

    if client is None or db is None:
        db_error = "mongo client or db not initialized on app.state"
    else:
        try:
            await db.command("ping")
            db_ok = True
        except Exception as e:
            db_error = repr(e) + "\n" + traceback.format_exc(limit=1)

    return {"ok": True, "db_connected": db_ok, "db_error": db_error}


# ---------------- END of app/main.py ----------------
