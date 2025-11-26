from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    size: Optional[str] = None
    image: Optional[str] = None

class ShippingAddress(BaseModel):
    fullName: str
    phone: str
    pincode: str
    addressLine1: str
    addressLine2: Optional[str] = ""
    city: str
    state: str
    country: str
    landmark: Optional[str] = ""

class OrderCreate(BaseModel):
    email: str
    items: List[OrderItem]
    amount: float
    shipping_address: ShippingAddress

class OrderDB(OrderCreate):
    id: Optional[str] = Field(default=None, alias="_id")
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: str = "PENDING_PAYMENT"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
