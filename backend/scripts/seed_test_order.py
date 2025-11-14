# backend/scripts/seed_test_order.py

from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from bson import ObjectId

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "jlrp"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    order = {
        "_id": ObjectId(),   # random order id
        "customer_email": "customer@example.com",  # same as stub user
        "status": "delivered",
        "items": [
            {
                "product_id": "P12345",
                "price": 499,  # rupees
            }
        ],
        "razorpay_payment_id": "pay_test_1234567890",
    }

    await db["orders"].insert_one(order)

    print("Order inserted:")
    print("order_id =", str(order["_id"]))
    print("product_id =", order["items"][0]["product_id"])

asyncio.run(main())
