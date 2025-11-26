# 👔 **JLRP Clothing E-commerce Platform**

A modern fashion e-commerce backend + frontend system built for scale, testing, and future real-world delivery integration.

> No business inventory needed to test.  
> No customer login required.  
> Admin controls all orders & product management.

---

## ✨ **Highlights**

- 🛍️ Product listing, details, cart, checkout
- 💳 Razorpay payment integration
- 🔐 Admin dashboard with JWT authentication
- 📦 Order storage in MongoDB
- 🚚 Tracking page + courier fields support
- 📩 Automatic email notifications:
  - `SHIPPED`
  - `DELIVERED`
  - `CANCELLED`

---

## 🧠 **System Flow Overview**


1️⃣ Backend Setup
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

2️⃣ Frontend Setup
cd frontend
npm install
npm run dev

🔗 Key Working Routes
Customer View (Public)

🏠 Home: /
🛒 Cart: /cart
🚦Track Order:
/track?orderId=<ORDER_ID>
(Clicking email button opens this page to show live status)

Admin Panel (Secure)

🔑 Login: /admin/login
📊 Dashboard: /admin/dashboard
👕 Products: /admin/products
📦 Orders: /admin/orders
🚚 Tracking Manage: /admin/tracking

Made with Inscoding❤️
