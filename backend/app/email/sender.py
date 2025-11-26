# app/email/sender.py

import os
import asyncio
import smtplib
import ssl
from email.message import EmailMessage

from .renderer import render_email

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))  # 587 = STARTTLS
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
FROM_NAME = os.getenv("EMAIL_FROM_NAME", "JLRP Brand World")


async def _send_raw_email(to_email: str, subject: str, html_body: str):
    """
    Simple async wrapper around smtplib to send HTML email.
    Uses SMTP_* env vars (same as rest of your project).
    Logs errors to console so we can debug.
    """

    print("[email] Trying to send email")
    print("[email] SMTP_HOST:", SMTP_HOST, "PORT:", SMTP_PORT)
    print("[email] SMTP_USER:", SMTP_USER)

    if not SMTP_USER or not SMTP_PASS:
        print("[email] ERROR: SMTP_USER or SMTP_PASS not set. Cannot send email.")
        return

    def _send_blocking():
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
            msg["To"] = to_email

            plain_text = "This email requires an HTML-compatible client."
            msg.set_content(plain_text)
            msg.add_alternative(html_body, subtype="html")

            context = ssl.create_default_context()

            # Use STARTTLS on 587
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)

            print("[email] Sent successfully to", to_email)
        except Exception as e:
            print("[email] ERROR while sending:", repr(e))

    await asyncio.to_thread(_send_blocking)


async def send_order_shipped_email_customer(
    to_email: str,
    *,
    customer_name: str,
    order_id: str,
    order_date: str,
    total_amount: str,
    tracking_url: str | None = None,
    tracking_id: str | None = None,
    courier_name: str | None = None,
    currency: str = "₹",
    brand_name: str = "JLRP Brand World",
    brand_website: str = "https://example.com",
):
    subject = f"Your order #{order_id} has been shipped"

    html = render_email(
        "order_shipped_customer.html",
        {
            "subject": subject,
            "brand_name": brand_name,
            "brand_website": brand_website,
            "customer_name": customer_name,
            "order_id": order_id,
            "order_date": order_date,
            "total_amount": total_amount,
            "currency": currency,
            "tracking_url": tracking_url,
            "tracking_id": tracking_id,
            "courier_name": courier_name,
        },
    )

    await _send_raw_email(to_email=to_email, subject=subject, html_body=html)


async def send_order_delivered_email_customer(
    to_email: str,
    *,
    customer_name: str,
    order_id: str,
    delivered_date: str,
    total_amount: str,
    tracking_url: str | None = None,
    currency: str = "₹",
    brand_name: str = "JLRP Brand World",
    brand_website: str = "https://example.com",
):
    subject = f"Your order #{order_id} has been delivered"

    html = render_email(
        "order_delivered_customer.html",
        {
            "subject": subject,
            "brand_name": brand_name,
            "brand_website": brand_website,
            "customer_name": customer_name,
            "order_id": order_id,
            "delivered_date": delivered_date,
            "total_amount": total_amount,
            "currency": currency,
            "tracking_url": tracking_url,
        },
    )

    await _send_raw_email(to_email=to_email, subject=subject, html_body=html)


async def send_order_cancelled_email_customer(
    to_email: str,
    *,
    customer_name: str,
    order_id: str,
    order_date: str,
    total_amount: str,
    currency: str = "₹",
    brand_name: str = "JLRP Brand World",
    brand_website: str = "https://example.com",
):
    subject = f"Your order #{order_id} has been cancelled"

    html = render_email(
        "order_cancelled_customer.html",
        {
            "subject": subject,
            "brand_name": brand_name,
            "brand_website": brand_website,
            "customer_name": customer_name,
            "order_id": order_id,
            "order_date": order_date,
            "total_amount": total_amount,
            "currency": currency,
        },
    )

    await _send_raw_email(to_email=to_email, subject=subject, html_body=html)
