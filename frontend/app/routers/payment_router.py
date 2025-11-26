# app/routers/payment_router.py
import os
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.models.order import OrderCreate, OrderDB  # <-- uses app/models/order.py

router = APIRouter(prefix="/payment", tags=["Payment"])

logger = logging.getLogger("payment_router")

# load keys from env
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET):
    logger.warning(
        "RAZORPAY keys not present in environment. "
        "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    )

try:
    import razorpay

    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except Exception as e:
    razorpay_client = None
    logger.exception("Failed to import/init razorpay client: %s", e)


class VerifyPayload(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    # optional metadata from frontend
    order_meta: Optional[dict] = None


@router.post("/create-order")
async def create_order(payload: OrderCreate, request: Request):
    """
    OPTION B FLOW:

    1) Create Razorpay order (amount = payload.amount rupees).
    2) Insert order into MongoDB 'orders' collection with status = PENDING_PAYMENT.
    3) Return Razorpay order + db_order_id to frontend.
    """
    if razorpay_client is None:
        raise HTTPException(
            status_code=500,
            detail="Razorpay client not initialized on server."
        )

    amount_rupees = float(payload.amount)
    if amount_rupees <= 0:
        raise HTTPException(
            status_code=400,
            detail="Amount must be positive (rupees).",
        )

    order_data = {
        "amount": int(round(amount_rupees * 100)),  # rupees → paise
        "currency": "INR",
        "payment_capture": 1,
    }

    # 1) create order in Razorpay
    try:
        rz_order = razorpay_client.order.create(order_data)
        logger.info("Created razorpay order: %s", rz_order.get("id"))
    except Exception as e:
        logger.exception("Error creating razorpay order: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create order: " + str(e))

    # 2) insert in MongoDB as PENDING_PAYMENT
    db = getattr(request.app.state, "db", None)
    db_order_id: Optional[str] = None

    if db is not None:
        try:
            orders_col = db.get_collection("orders")

            order_doc = OrderDB(
                email=payload.email,
                items=payload.items,
                amount=amount_rupees,
                shipping_address=payload.shipping_address,
                razorpay_order_id=rz_order["id"],
                status="PENDING_PAYMENT",
            ).dict(by_alias=True)

            now = datetime.utcnow()
            order_doc["created_at"] = now
            order_doc["updated_at"] = now

            result = await orders_col.insert_one(order_doc)
            db_order_id = str(result.inserted_id)

            logger.info("Inserted order %s into 'orders' collection", db_order_id)
        except Exception as e:
            # don't break payment if DB insert fails
            logger.exception("Failed to save order to DB: %s", e)

    # 3) return data to frontend
    return {
        "order_id": rz_order.get("id"),   # Razorpay order id
        "amount": amount_rupees,
        "currency": "INR",
        "db_order_id": db_order_id,
        "raw": rz_order,
    }


@router.post("/verify")
async def verify_payment(payload: VerifyPayload, request: Request):
    """
    Verify Razorpay payment signature.

    If signature valid:
      - mark order (by razorpay_order_id) as PAID
      - store payment info into 'payments' collection (optional)
    If invalid:
      - mark order as FAILED
    """
    if razorpay_client is None:
        raise HTTPException(
            status_code=500,
            detail="Razorpay client not initialized on server."
        )

    db = getattr(request.app.state, "db", None)

    # 1) verify signature with Razorpay
    try:
        razorpay_client.utility.verify_payment_signature(
            {
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError:
        logger.warning(
            "Signature verification failed for order %s",
            payload.razorpay_order_id,
        )

        # mark order as FAILED
        if db is not None:
            try:
                orders_col = db.get_collection("orders")
                await orders_col.update_one(
                    {"razorpay_order_id": payload.razorpay_order_id},
                    {
                        "$set": {
                            "status": "FAILED",
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
            except Exception as e:
                logger.exception("Failed to update order status to FAILED: %s", e)

        raise HTTPException(status_code=400, detail="Invalid payment signature")

    except Exception as e:
        logger.exception("Unexpected error during signature verification: %s", e)
        raise HTTPException(status_code=500, detail="Error verifying signature: " + str(e))

    # 2) signature OK → mark as PAID + save payment record
    if db is not None:
        try:
            orders_col = db.get_collection("orders")
            await orders_col.update_one(
                {"razorpay_order_id": payload.razorpay_order_id},
                {
                    "$set": {
                        "razorpay_payment_id": payload.razorpay_payment_id,
                        "status": "PAID",
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

            payments_col = db.get_collection("payments")
            record = {
                "order_id": payload.razorpay_order_id,
                "payment_id": payload.razorpay_payment_id,
                "signature": payload.razorpay_signature,
                "meta": payload.order_meta,
                "created_at": datetime.utcnow(),
            }
            await payments_col.insert_one(record)

            logger.info(
                "Saved payment record and updated order to PAID for order %s",
                payload.razorpay_order_id,
            )
        except Exception as e:
            # don't fail verification just because DB save failed
            logger.exception("Failed to save payment/update order in DB: %s", e)

    return JSONResponse(
        {
            "status": "success",
            "message": "Payment verified successfully!",
        }
    )
