# backend/app/routers/admin_dashboard.py

from datetime import datetime, date, time, timezone

from fastapi import APIRouter, Depends, Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(
    prefix="/admin",
    tags=["Admin Dashboard"],
)

# Local get_db using app.state.db set in main.py
async def get_db(request: Request) -> AsyncIOMotorDatabase:
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db


@router.get("/overview")
async def get_admin_overview(
    db: AsyncIOMotorDatabase = Depends(get_db),
    # NOTE: auth temporarily disabled until we wire correct dependency
    # current_admin: dict = Depends(get_current_admin),
):
    products_col = db["products"]
    orders_col = db["orders"]
    returns_col = db["return_requests"]

    today_start = datetime.combine(date.today(), time.min).replace(tzinfo=timezone.utc)

    # ---------- PRODUCTS ----------
    total_products = await products_col.count_documents({"is_active": True})

    # ---------- ORDERS ----------
    total_orders = await orders_col.count_documents({})
    today_orders = await orders_col.count_documents(
        {"created_at": {"$gte": today_start}}
    )

    # ---------- SALES (TOTAL) ----------
    total_sales = 0
    total_sales_cursor = orders_col.aggregate([
        {"$match": {"payment_status": "paid"}},          # adjust field if needed
        {"$group": {"_id": None, "amount": {"$sum": "$total_amount"}}},
    ])
    async for doc in total_sales_cursor:
        total_sales = doc["amount"]

    # ---------- SALES (TODAY) ----------
    today_sales = 0
    today_sales_cursor = orders_col.aggregate([
        {
            "$match": {
                "payment_status": "paid",
                "created_at": {"$gte": today_start},
            }
        },
        {"$group": {"_id": None, "amount": {"$sum": "$total_amount"}}},
    ])
    async for doc in today_sales_cursor:
        today_sales = doc["amount"]

    # ---------- RETURNS ----------
    pending_returns = await returns_col.count_documents({"status": "pending"})

    # ---------- LOW STOCK ----------
    LOW_STOCK_LIMIT = 5
    low_stock_items = await products_col.find(
        {"is_active": True, "stock": {"$lte": LOW_STOCK_LIMIT}},
        {"name": 1, "stock": 1},
    ).to_list(20)

    # ---------- FINAL RESPONSE (NESTED FORMAT) ----------
    return {
        "stats": {
            "products": {
                "total": total_products,
            },
            "orders": {
                "total": total_orders,
                "today": today_orders,
            },
            "sales": {
                "total_revenue": float(total_sales),
                "today_revenue": float(today_sales),
            },
            "returns": {
                "pending": pending_returns,
            },
            "stock": {
                "low_stock_count": len(low_stock_items),
            },
        },
        "low_stock_items": low_stock_items,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
