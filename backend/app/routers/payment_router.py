# app/routers/payment_router.py
import os
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

# optional: import app state when saving to DB
# (we access request.app.state.db in routes)
router = APIRouter(prefix="/payment", tags=["Payment"])

# configure logging
logger = logging.getLogger("payment_router")

# load keys from env
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET):
    logger.warning("RAZORPAY keys not present in environment. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")

try:
    import razorpay
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except Exception as e:
    razorpay_client = None
    logger.exception("Failed to import/init razorpay client: %s", e)


class CreateOrderPayload(BaseModel):
    amount: int  # rupees (integer). e.g. 499


class VerifyPayload(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    # optional metadata
    order_meta: Optional[dict] = None


@router.post("/create-order")
async def create_order(payload: CreateOrderPayload, request: Request):
    """
    Create a Razorpay order.
    Expects amount in rupees (integer). Server converts to paise.
    Returns order_id and echo of amount/currency.
    """
    if razorpay_client is None:
        raise HTTPException(status_code=500, detail="Razorpay client not initialized on server.")

    amount_rupees = int(payload.amount)
    if amount_rupees <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive integer (rupees).")

    order_data = {
        "amount": amount_rupees * 100,  # convert to paise
        "currency": "INR",
        "payment_capture": 1,
        # you can add "notes" here if you want
    }

    try:
        order = razorpay_client.order.create(order_data)
        logger.info("Created razorpay order: %s", order.get("id"))
        return {"order_id": order.get("id"), "amount": amount_rupees, "currency": "INR", "raw": order}
    except Exception as e:
        logger.exception("Error creating razorpay order: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create order: " + str(e))


@router.post("/verify")
async def verify_payment(payload: VerifyPayload, request: Request):
    """
    Verify Razorpay payment signature.
    Body must include: razorpay_order_id, razorpay_payment_id, razorpay_signature
    On success returns status: success. Optionally persists to DB if available.
    """
    if razorpay_client is None:
        raise HTTPException(status_code=500, detail="Razorpay client not initialized on server.")

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        })
    except razorpay.errors.SignatureVerificationError:
        logger.warning("Signature verification failed for order %s", payload.razorpay_order_id)
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.exception("Unexpected error during signature verification: %s", e)
        raise HTTPException(status_code=500, detail="Error verifying signature: " + str(e))

    # optional: store payment in DB if app.state.db exists
    db = getattr(request.app.state, "db", None)
    if db is not None:
        try:
            record = {
                "order_id": payload.razorpay_order_id,
                "payment_id": payload.razorpay_payment_id,
                "signature": payload.razorpay_signature,
                "meta": payload.order_meta,
            }
            await db.get_collection("payments").insert_one(record)
            logger.info("Saved payment record to DB for order %s", payload.razorpay_order_id)
        except Exception as e:
            # Log but don't fail verification because DB save is optional
            logger.exception("Failed to save payment to DB: %s", e)

    return JSONResponse({"status": "success", "message": "Payment verified successfully!"})
