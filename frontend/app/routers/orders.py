# app/routers/orders.py

from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.email.sender import (
    send_order_shipped_email_customer,
    send_order_delivered_email_customer,
    send_order_cancelled_email_customer,
)


# ---------- DB dependency using app.state.db ----------

async def get_db(request: Request) -> AsyncIOMotorDatabase:
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db


# ---------- Pydantic models (basic) ----------

class OrderItem(BaseModel):
    product_id: str
    title: str
    quantity: int
    price: float
    size: Optional[str] = None
    image: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    # "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
    status: str
    tracking_url: Optional[str] = None
    tracking_id: Optional[str] = None
    courier_name: Optional[str] = None


# NEW: Public tracking response (what customer sees)
class PublicOrderStatus(BaseModel):
    order_id: str
    status: str
    created_at: Optional[datetime] = None
    total_amount: Optional[float] = None
    tracking_url: Optional[str] = None
    tracking_id: Optional[str] = None
    courier_name: Optional[str] = None


# Admin router (your existing one)
router = APIRouter(
    prefix="/admin",        # paths start with /admin/...
    tags=["orders"],
)


# ---------- Admin Routes ----------

@router.get("/orders")
async def list_admin_orders(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    List all orders for admin.
    """
    orders_col = db["orders"]

    cursor = orders_col.find().sort("created_at", -1)
    results: List[dict] = []

    async for doc in cursor:
        # always send string _id to frontend (even if it's None/null)
        doc["_id"] = str(doc.get("_id"))
        results.append(doc)

    return results


@router.get("/orders/{order_id}")
async def get_admin_order(
    order_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return full order document for a single order (for admin "View" button).

    We primarily match on `razorpay_order_id`, but also fall back to various id
    possibilities so future changes still work.
    """
    orders_col = db["orders"]

    query = {
        "$or": [
            {"razorpay_order_id": order_id},
            {"_id": order_id},
            {"id": order_id},
        ]
    }

    # if order_id looks like ObjectId, also try that
    try:
        oid = ObjectId(order_id)
        query["$or"].append({"_id": oid})
    except Exception:
        pass

    doc = await orders_col.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")

    doc["_id"] = str(doc.get("_id"))
    return doc


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Update order.status by id and send customer email for SHIPPED / DELIVERED / CANCELLED.

    Frontend sends the `razorpay_order_id` as order_id.
    """
    orders_col = db["orders"]

    query = {
        "$or": [
            {"razorpay_order_id": order_id},
            {"_id": order_id},
            {"id": order_id},
        ]
    }

    try:
        oid = ObjectId(order_id)
        query["$or"].append({"_id": oid})
    except Exception:
        pass

    # build $set data
    set_data = {"status": payload.status}
    if payload.tracking_url is not None:
        set_data["tracking_url"] = payload.tracking_url
    if payload.tracking_id is not None:
        set_data["tracking_id"] = payload.tracking_id
    if payload.courier_name is not None:
        set_data["courier_name"] = payload.courier_name

    updated = await orders_col.find_one_and_update(
        query,
        {"$set": set_data},
        return_document=ReturnDocument.AFTER,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")

    # ---------- prepare data for customer email ----------

    new_status = payload.status.upper()

    # which email field your orders use
    customer_email = updated.get("email") or updated.get("customer_email")
    customer_name = (
        updated.get("customer_name")
        or updated.get("shipping_name")
        or updated.get("name")
        or "Customer"
    )

    # order date (from created_at if present)
    order_date = ""
    created_at = updated.get("created_at")
    if isinstance(created_at, datetime):
        order_date = created_at.strftime("%d-%m-%Y")
    elif created_at:
        order_date = str(created_at)

    total_amount = str(
        updated.get("total_amount")
        or updated.get("amount")
        or ""
    )

    tracking_url = payload.tracking_url or updated.get("tracking_url")
    tracking_id = payload.tracking_id or updated.get("tracking_id")
    courier_name = payload.courier_name or updated.get("courier_name")

    # ---------- send email based on status ----------
    if customer_email:
        if new_status == "SHIPPED":
            background_tasks.add_task(
                send_order_shipped_email_customer,
                to_email=customer_email,
                customer_name=customer_name,
                order_id=str(updated.get("_id")),
                order_date=order_date,
                total_amount=total_amount,
                tracking_url=tracking_url,
                tracking_id=tracking_id,
                courier_name=courier_name,
            )
        elif new_status == "DELIVERED":
            background_tasks.add_task(
                send_order_delivered_email_customer,
                to_email=customer_email,
                customer_name=customer_name,
                order_id=str(updated.get("_id")),
                delivered_date=order_date,  # you can later store a separate delivered_at
                total_amount=total_amount,
                tracking_url=tracking_url,
            )
        elif new_status == "CANCELLED":
            background_tasks.add_task(
                send_order_cancelled_email_customer,
                to_email=customer_email,
                customer_name=customer_name,
                order_id=str(updated.get("_id")),
                order_date=order_date,
                total_amount=total_amount,
            )

    # always send _id as string back to frontend
    updated["_id"] = str(updated.get("_id"))
    return updated


# ---------- NEW: Public tracking endpoint for customers ----------

public_router = APIRouter(
    prefix="/public",
    tags=["public-orders"],
)


@public_router.get("/orders/track/{order_id}", response_model=PublicOrderStatus)
async def track_order_public(
    order_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Public endpoint for customers to track their order.

    This is used by the "Track my order" button or track.html page.
    We expose only safe fields.
    """
    orders_col = db["orders"]

    query = {
        "$or": [
            {"razorpay_order_id": order_id},
            {"_id": order_id},
            {"id": order_id},
        ]
    }

    try:
        oid = ObjectId(order_id)
        query["$or"].append({"_id": oid})
    except Exception:
        pass

    doc = await orders_col.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")

    return PublicOrderStatus(
        order_id=str(doc.get("_id") or order_id),
        status=str(doc.get("status") or "PENDING"),
        created_at=doc.get("created_at"),
        total_amount=doc.get("total_amount") or doc.get("amount"),
        tracking_url=doc.get("tracking_url"),
        tracking_id=doc.get("tracking_id"),
        courier_name=doc.get("courier_name"),
    )
