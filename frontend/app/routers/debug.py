from fastapi import APIRouter, BackgroundTasks
from app.email.sender import send_order_shipped_email_customer

router = APIRouter(prefix="/debug", tags=["debug"])

@router.post("/test-shipped-email")
async def test_shipped_email(background_tasks: BackgroundTasks):
    # hard-coded dummy data to test
    test_email = "musalamadugushivapradeep@gmail.com"

    background_tasks.add_task(
        send_order_shipped_email_customer,
        to_email=test_email,
        customer_name="Test User",
        order_id="JLRP1234",
        order_date="22-11-2025",
        total_amount="9999",
        tracking_url="https://tracking.example.com/JLRP1234",
        tracking_id="TRK123456789",
        courier_name="DTDC"
    )

    return {"ok": True, "msg": "queued shipped email"}
