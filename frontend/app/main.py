# app/main.py
"""
JLRP backend entrypoint (simple settings via environment).

Improvements:
- Loads .env from backend root first (one level above app/), then app/.env, then CWD .env.
- Prints which .env path was loaded (dev-only debug print).
- Keeps routers, debug endpoints, and startup/shutdown lifecycle.
"""
from dotenv import load_dotenv
import os
import traceback
from typing import List, Optional, Dict
from urllib.parse import urlparse
from pathlib import Path

# ALWAYS load .env from backend root (one level above app/)
BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = BACKEND_ROOT / ".env"

# Try to load main backend .env first, then fallbacks
_loaded_env = None
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
    _loaded_env = str(ENV_PATH)
else:
    # fallback candidates: app/.env, repo root .env, cwd .env
    _here = Path(__file__).resolve().parent
    _env_candidates = [
        _here / ".env",
        _here.parent / ".env",
        Path.cwd() / ".env",
    ]
    for p in _env_candidates:
        if p.exists():
            load_dotenv(p)
            _loaded_env = str(p)
            break
    if _loaded_env is None:
        # last resort: let python-dotenv try defaults
        load_dotenv()

# Dev debug print: which .env (if any) was used
if _loaded_env:
    print(f"[startup] Loaded environment from: {_loaded_env}")
else:
    print("[startup] No .env file found; using system environment variables")

from fastapi import FastAPI, Request, Form, BackgroundTasks
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
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---------- Helper: decide TLS usage ----------
def _should_use_tls(uri: str) -> bool:
    if uri is None:
        return False
    low = uri.lower().strip()
    if low.startswith("mongodb+srv://"):
        return True
    try:
        parsed = urlparse(uri)
        hostname = parsed.hostname or ""
        if hostname in ("localhost", "127.0.0.1", "::1"):
            return False
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
    try:
        if USE_TLS:
            try:
                client = AsyncIOMotorClient(MONGO_URI, tls=True, tlsCAFile=CA_BUNDLE)
                app.state.mongo_client = client
                app.state.db = client[DB_NAME]
                try:
                    await app.state.db.command("ping")
                    print("[startup] MongoDB connected (TLS, certifi CA bundle)")
                except Exception as ping_exc:
                    print("[startup] MongoDB TLS ping failed:", repr(ping_exc))
            except Exception as e:
                print("[startup] Creating TLS client failed:", repr(e))

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

            if getattr(app.state, "db", None) is None:
                print("[startup] MongoDB TLS attempts exhausted; leaving client attached if any.")
        else:
            client = AsyncIOMotorClient(MONGO_URI)
            app.state.mongo_client = client
            app.state.db = client[DB_NAME]
            try:
                await app.state.db.command("ping")
                print("[startup] MongoDB connected (no TLS, local)")
            except Exception as ping_exc:
                print("[startup] MongoDB connection ping failed (no TLS):", repr(ping_exc))
    except Exception as e:
        print("[startup] Failed to create Mongo client:", repr(e))

    # Best-effort ensure indexes (if routers expose ensure_indexes)
    try:
        from app.routers import return_requests as return_requests_module
        try:
            await return_requests_module.ensure_indexes(getattr(app.state, "db", None))
            print("[startup] Ensured indexes for return_requests (if db available)")
        except Exception as e:
            print("[startup] Could not ensure indexes for return_requests:", repr(e))
    except Exception:
        pass

    try:
        from app.routers import products as products_module
        try:
            await products_module.ensure_indexes()
            print("[startup] Ensured indexes for products (if db available)")
        except Exception as e:
            print("[startup] Could not ensure indexes for products:", repr(e))
    except Exception:
        pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client: Optional[AsyncIOMotorClient] = getattr(app.state, "mongo_client", None)
    if client:
        client.close()
        print("[shutdown] MongoDB client closed")

# ---------- Routers ----------
try:
    from app.routers import auth as auth_router_module
    app.include_router(auth_router_module.router)
    print("[startup] Included router: auth")
except Exception as e:
    print("[startup] Could not include auth router:", e)

try:
    from app.routers import password_reset_db as password_reset_module
    app.include_router(password_reset_module.router)
    print("[startup] Included router: password_reset_db")
except Exception as e:
    print("[startup] Could not include password_reset_db router:", e)

try:
    from app.routers import payment_router as payment_router_module
    app.include_router(payment_router_module.router)
    print("[startup] Included router: payment")
except Exception as e:
    print("[startup] Could not include payment router:", e)

try:
    from app.routers import admin_auth as admin_auth_module
    app.include_router(admin_auth_module.router)
    print("[startup] Included router: admin_auth")
except Exception as e:
    print("[startup] Could not include admin_auth router (ok if not present):", e)

try:
    from app.routers import admin as admin_module
    app.include_router(admin_module.router)
    print("[startup] Included router: admin")
except Exception:
    pass

try:
    from app.routers import admin_uploads as admin_uploads_module
    app.include_router(admin_uploads_module.router)
    print("[startup] Included router: admin_uploads")
except Exception as e:
    print("[startup] Could not include admin_uploads router (ok if not present):", e)

try:
    from app.routers import return_requests as return_requests_module
    app.include_router(return_requests_module.router)
    print("[startup] Included router: return_requests")
except Exception as e:
    print("[startup] Could not include return_requests router (ok if not present):", e)

try:
    from app.routers import products as products_module
    app.include_router(products_module.router)
    print("[startup] Included router: products")
except Exception as e:
    print("[startup] Could not include products router (ok if not present):", e)

try:
    from app.routers import orders as orders_module
    # Admin orders router (existing)
    app.include_router(orders_module.router)
    print("[startup] Included router: orders")

    # 🔥 NEW: Public tracking router for customers (/public/orders/track/...)
    app.include_router(orders_module.public_router)
    print("[startup] Included router: public_orders")

except Exception as e:
    print("[startup] Could not include orders router(s) (ok if not present):", e)

try:
    from app.routers import admin_dashboard as admin_dashboard_module
    app.include_router(admin_dashboard_module.router)
    print("[startup] Included router: admin_dashboard")
except Exception as e:
    print("[startup] Could not include admin_dashboard router (ok if not present):", e)

# ---------- TEMP DEBUG ROUTES (remove after debug) ----------
@app.get("/debug/db-info")
async def debug_db_info(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        return {"ok": False, "error": "app.state.db is not initialized"}
    try:
        cols = await db.list_collection_names()
    except Exception as e:
        cols = f"error listing collections: {repr(e)}"
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


# ---------- Debug: send test email (dev only) ----------
@app.post("/debug/send-test-email")
async def debug_send_test_email(background_tasks: BackgroundTasks):
    try:
        from app.core.email_utils import send_order_confirmation_email
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"email utils import failed: {e}"}, status_code=500)

    test_order = {
        "razorpay_order_id": "order_TEST12345",
        "email": os.getenv("SMTP_USER"),
        "amount": 123.45,
        "status": "PENDING",
        "items": [{"name": "Test Shirt", "price": 499.99, "quantity": 1}],
    }

    background_tasks.add_task(send_order_confirmation_email, test_order)
    return {"ok": True, "msg": "queued test email"}


# ---------- NEW Debug routes for order status emails ----------

@app.post("/debug/test-shipped-email")
async def debug_test_shipped_email(background_tasks: BackgroundTasks):
    """
    Test 'Order Shipped' email for customer with pretty tracking button.
    """
    from app.email.sender import send_order_shipped_email_customer

    test_email = os.getenv("SMTP_USER") or "your-email@example.com"

    background_tasks.add_task(
        send_order_shipped_email_customer,
        to_email=test_email,
        customer_name="Test Customer",
        order_id="JLRP1234",
        order_date="23-11-2025",
        total_amount="9999",
        tracking_url="https://tracking.example.com/JLRP1234",
        tracking_id="TRK123456789",
        courier_name="Delhivery",
    )
    return {"ok": True, "msg": "queued shipped email"}


@app.post("/debug/test-delivered-email")
async def debug_test_delivered_email(background_tasks: BackgroundTasks):
    """
    Test 'Order Delivered' email for customer.
    """
    from app.email.sender import send_order_delivered_email_customer

    test_email = os.getenv("SMTP_USER") or "your-email@example.com"

    background_tasks.add_task(
        send_order_delivered_email_customer,
        to_email=test_email,
        customer_name="Test Customer",
        order_id="JLRP1234",
        delivered_date="24-11-2025",
        total_amount="9999",
        tracking_url="https://tracking.example.com/JLRP1234",
    )
    return {"ok": True, "msg": "queued delivered email"}


@app.post("/debug/test-cancelled-email")
async def debug_test_cancelled_email(background_tasks: BackgroundTasks):
    """
    Test 'Order Cancelled' email for customer.
    """
    from app.email.sender import send_order_cancelled_email_customer

    test_email = os.getenv("SMTP_USER") or "your-email@example.com"

    background_tasks.add_task(
        send_order_cancelled_email_customer,
        to_email=test_email,
        customer_name="Test Customer",
        order_id="JLRP1234",
        order_date="22-11-2025",
        total_amount="9999",
    )
    return {"ok": True, "msg": "queued cancelled email"}


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
