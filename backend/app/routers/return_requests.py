# app/routers/return_requests.py
"""
Return requests router — uses dependency helpers from app.dependencies.

Place this file at: app/routers/return_requests.py
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
from bson import ObjectId

# import dependency helpers from dedicated module to avoid circular imports
from app.dependencies import get_db, get_current_user, get_admin_user

router = APIRouter(prefix="/returns", tags=["returns"])

RETURN_COLLECTION = "return_requests"


# --- Pydantic schemas ---
class ReturnCreate(BaseModel):
    order_id: str
    product_id: str
    reason: str = Field(..., min_length=3)
    photos: Optional[List[str]] = None  # safer default


class ReturnDoc(BaseModel):
    id: Optional[str]
    order_id: str
    product_id: str
    customer_email: EmailStr
    reason: str
    photos: List[str] = []
    status: str
    requested_at: datetime
    admin_action_at: Optional[datetime] = None
    refund_amount: Optional[int] = None  # in paise
    razorpay_payment_id: Optional[str] = None
    razorpay_refund_id: Optional[str] = None
    admin_note: Optional[str] = None


class AdminAction(BaseModel):
    request_id: str
    action: str  # "approve" | "reject"
    admin_note: Optional[str] = None


# --- Helpers ---
async def ensure_indexes(db: AsyncIOMotorDatabase):
    """Create useful indexes for the returns collection (best-effort)."""
    if db is None:
        return
    coll = db[RETURN_COLLECTION]
    await coll.create_index("order_id")
    await coll.create_index("customer_email")
    await coll.create_index("status")


# Razorpay helper
def get_razorpay_client():
    """
    Return razorpay.Client if configured, otherwise None.
    Local import so project doesn't require razorpay in tests.
    """
    try:
        import razorpay  # local import so tests don't require razorpay
    except Exception:
        return None
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


async def call_razorpay_refund(payment_id: str, amount_paise: int):
    """
    Call Razorpay refund API in a threadpool (since their client is synchronous).
    Raises RuntimeError with a helpful message on failure.
    """
    client = get_razorpay_client()
    if client is None:
        raise RuntimeError("Razorpay client not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env")
    # run blocking call in threadpool
    import asyncio
    loop = asyncio.get_running_loop()

    def sync_call():
        try:
            return client.payment.refund(payment_id, {"amount": amount_paise})
        except Exception as e:
            # wrap any razorpay error for clearer logs
            raise RuntimeError(f"Razorpay refund call error: {e}")

    resp = await loop.run_in_executor(None, sync_call)
    return resp


# --- Endpoints ---
@router.post("/request", status_code=status.HTTP_201_CREATED, response_model=ReturnDoc)
async def create_return_request(
    payload: ReturnCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Create a return request. Verifies order exists and is delivered.
    Expects orders collection with:
      - _id (ObjectId or string)
      - customer_email
      - status == "delivered"
      - items: list with product_id and price
      - razorpay_payment_id (for refunds)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # try lookup by ObjectId, then by string id
    order = None
    try:
        oid = ObjectId(payload.order_id)
        order = await db["orders"].find_one({"_id": oid})
    except Exception:
        order = await db["orders"].find_one({"_id": payload.order_id})

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("customer_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Order does not belong to user")
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order not delivered yet; cannot return")

    # calculate refund amount for product_id (price expected in rupees)
    refund_amount_paise = 0
    for item in order.get("items", []):
        if str(item.get("product_id")) == str(payload.product_id):
            refund_amount_paise = int(float(item.get("price", 0)) * 100)
            break
    if refund_amount_paise == 0:
        raise HTTPException(status_code=400, detail="Product not found in order or price is zero")

    doc = {
        "order_id": payload.order_id,
        "product_id": payload.product_id,
        "customer_email": current_user.get("email"),
        "reason": payload.reason,
        "photos": payload.photos or [],
        "status": "pending",
        "requested_at": datetime.utcnow(),
        "refund_amount": refund_amount_paise,
        "razorpay_payment_id": order.get("razorpay_payment_id"),
    }

    coll = db[RETURN_COLLECTION]
    res = await coll.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return ReturnDoc(**doc)


@router.get("/admin/list", response_model=List[ReturnDoc])
async def admin_list_returns(
    db: AsyncIOMotorDatabase = Depends(get_db), admin_user: Dict = Depends(get_admin_user)
):
    """Admin: list return requests"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database dependency not provided")
    coll = db[RETURN_COLLECTION]
    cursor = coll.find({}).sort("requested_at", -1).limit(200)
    items = []
    async for r in cursor:
        r["id"] = str(r.get("_id"))
        items.append(ReturnDoc(**r))
    return items


@router.post("/admin/action")
async def admin_action(
    action: AdminAction,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_user: Dict = Depends(get_admin_user),
):
    """Admin approve or reject a return request. Approve triggers Razorpay refund."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database dependency not provided")

    coll = db[RETURN_COLLECTION]
    # lookup by ObjectId or string
    req = None
    try:
        req = await coll.find_one({"_id": ObjectId(action.request_id)})
    except Exception:
        req = await coll.find_one({"_id": action.request_id})

    if not req:
        raise HTTPException(status_code=404, detail="Return request not found")

    if action.action == "approve":
        if req.get("status") in ("refunded", "approved"):
            raise HTTPException(status_code=400, detail="Already processed")
        payment_id = req.get("razorpay_payment_id")
        amount = req.get("refund_amount")
        if not payment_id or not amount:
            raise HTTPException(status_code=400, detail="Payment id or amount missing; cannot refund")
        try:
            refund_resp = await call_razorpay_refund(payment_id, amount)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Refund failed: {e}")
        update = {
            "$set": {
                "status": "refunded",
                "admin_action_at": datetime.utcnow(),
                "razorpay_refund_id": refund_resp.get("id") if isinstance(refund_resp, dict) else None,
                "admin_note": action.admin_note,
            }
        }
        await coll.update_one({"_id": req.get("_id")}, update)
        background_tasks.add_task(send_refund_email, req.get("customer_email"), amount)
        return {"ok": True, "refund": refund_resp}

    elif action.action == "reject":
        if req.get("status") not in ("pending", "pickup-scheduled"):
            raise HTTPException(status_code=400, detail="Cannot reject processed request")
        await coll.update_one(
            {"_id": req.get("_id")},
            {"$set": {"status": "rejected", "admin_action_at": datetime.utcnow(), "admin_note": action.admin_note}},
        )
        background_tasks.add_task(send_rejection_email, req.get("customer_email"), action.admin_note)
        return {"ok": True}
    else:
        raise HTTPException(status_code=400, detail="Unknown action")


# --- Background helpers ---
async def send_refund_email(email_to: str, amount_paise: int):
    # replace with your project's async email sender
    amount_rupees = amount_paise / 100
    subject = f"Refund processed: Rs {amount_rupees}"
    body = f"Your return has been approved and Rs {amount_rupees} has been refunded."
    try:
        # await send_email_async(email_to, subject, body)
        pass
    except Exception:
        pass


async def send_rejection_email(email_to: str, admin_note: Optional[str]):
    subject = "Return request rejected"
    body = f"Your return request was rejected. Note: {admin_note or 'No note provided.'}"
    try:
        # await send_email_async(email_to, subject, body)
        pass
    except Exception:
        pass
