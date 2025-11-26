# backend/app/core/email_utils.py
import os
import ssl
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List

# Read SMTP config from env and trim aggressively
SMTP_HOST = (os.getenv("SMTP_HOST", "smtp.gmail.com") or "").strip()
SMTP_PORT = int((os.getenv("SMTP_PORT", "587") or "587").strip())
SMTP_USER = (os.getenv("SMTP_USER") or "").strip()
SMTP_PASS = (os.getenv("SMTP_PASS") or "").strip()
SMTP_FROM = (os.getenv("SMTP_FROM") or SMTP_USER or "no-reply@example.com").strip()
FRONTEND_BASE_URL = (os.getenv("FRONTEND_BASE_URL", "http://localhost:3000") or "").strip()

def _send_email_raw(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """
    Synchronous SMTP send. Dev-friendly: prints debug info on failure.
    In production prefer an API provider (SendGrid/SES/Postmark) or background worker.
    """
    # Basic validation
    if not (SMTP_HOST and SMTP_PORT and SMTP_USER and SMTP_PASS):
        print("[email] SMTP config incomplete - skipping send. "
              f"user={repr(SMTP_USER)} pass_len={len(SMTP_PASS)} host={SMTP_HOST} port={SMTP_PORT}")
        return

    # Build message
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body or "")
    msg.add_alternative(html_body, subtype="html")

    # Debug: show trimmed values (dev only)
    print("[email DEBUG] Using SMTP_HOST,PORT:", SMTP_HOST, SMTP_PORT)
    print("[email DEBUG] SMTP_USER repr:", repr(SMTP_USER))
    print("[email DEBUG] SMTP_PASS len:", len(SMTP_PASS))

    try:
        # If port is 465, use SSL; else use STARTTLS (587, 25)
        if SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30, context=context) as smtp:
                smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)
        else:
            # STARTTLS flow
            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)
        print(f"[email] Sent email to {to_email} subject={subject}")
    except smtplib.SMTPAuthenticationError as e:
        # show the exact server message for debugging (Gmail gives useful reasons)
        try:
            code = e.smtp_code
            err = e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error
        except Exception:
            code, err = None, str(e)
        print(f"[email ERROR] SMTP auth failed: code={code} err={err}")
        raise
    except Exception as e:
        print("[email ERROR] SMTP sending exception:", type(e).__name__, e)
        raise

# rest of your helpers unchanged
def _items_html(items: List[Dict[str, Any]]) -> str:
    if not items:
        return "<li>(no items)</li>"
    parts = []
    for it in items:
        name = it.get("name") or it.get("title") or "Item"
        qty = it.get("quantity", 1)
        price = it.get("price", 0)
        parts.append(f"<li>{name} × {qty} — ₹{price}</li>")
    return "\n".join(parts)


def send_order_confirmation_email(order: Dict[str, Any]) -> None:
    to_email = order.get("email")
    if not to_email:
        print("[email] no recipient for confirmation; skipping")
        return

    order_id = order.get("razorpay_order_id") or str(order.get("_id"))
    amount = order.get("amount", order.get("totalAmount", 0))
    status = order.get("status", "PENDING")
    track_url = f"{FRONTEND_BASE_URL}/track/{order_id}"

    subject = f"Order Confirmed — {order_id}"

    html = f"""
    <div style="font-family: Arial, sans-serif; color:#111;">
      <h2>Thanks for your order 🎉</h2>
      <p>Your order <strong>{order_id}</strong> has been received.</p>
      <p><strong>Total:</strong> ₹{amount}</p>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Items</strong></p>
      <ul>{_items_html(order.get('items', []))}</ul>
      <p>You can track your order here: <a href="{track_url}">{track_url}</a></p>
      <hr/>
      <p style="font-size:12px;color:#666">If you didn't place this order, reply to this email immediately.</p>
    </div>
    """
    text = f"Your order {order_id} is confirmed.\nTotal: ₹{amount}\nStatus: {status}\nTrack: {track_url}"
    _send_email_raw(to_email, subject, html, text)


def send_order_status_update_email(order: Dict[str, Any], old_status: str, new_status: str) -> None:
    to_email = order.get("email")
    if not to_email:
        print("[email] no recipient for status update; skipping")
        return

    order_id = order.get("razorpay_order_id") or str(order.get("_id"))
    amount = order.get("amount", order.get("totalAmount", 0))
    track_url = f"{FRONTEND_BASE_URL}/track/{order_id}"

    subject = f"Order Update — {order_id} is now {new_status}"

    html = f"""
    <div style="font-family: Arial, sans-serif; color:#111;">
      <h2>Order status updated</h2>
      <p>Your order <strong>{order_id}</strong> changed status.</p>
      <p><strong>Previous:</strong> {old_status}</p>
      <p><strong>Now:</strong> {new_status}</p>
      <p><strong>Total:</strong> ₹{amount}</p>
      <p>Track here: <a href="{track_url}">{track_url}</a></p>
      <hr/>
      <p style="font-size:12px;color:#666">Thanks for shopping with us.</p>
    </div>
    """
    text = f"Order {order_id}: {old_status} -> {new_status}\nTrack: {track_url}"
    _send_email_raw(to_email, subject, html, text)
