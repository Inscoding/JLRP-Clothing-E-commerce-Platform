👔 JLRP Clothing – E-commerce Platform

A complete fashion e-commerce system with Razorpay payments, admin dashboard controls, and public order tracking using real delivery partner integrations.

🚀 Ready to Run From Scratch

Add or modify products in admin panel

Place customer orders and pay via Razorpay

Store orders securely in MongoDB

Update order status (PENDING / SHIPPED / DELIVERED / CANCELLED)

Send automatic emails for shipping, delivery, and cancellation

Public Track Order page (no login required)

Integrations supported: Shiprocket & Delhivery

Can be started and tested without any existing business inventory

✨ Tech Stack
Component	Technology
Frontend	Next.js 15, TypeScript, Tailwind CSS
Backend	FastAPI, MongoDB, JWT, BackgroundTasks, Emails
Payments	Razorpay Order API + Webhooks
Tracking	Public page using orderId and tracking URL
🧠 How the System Works

Admin uploads clothes & product details

Customer visits shop → sees products (no signup needed)

Customer places order & pays using Razorpay

Backend stores order in DB

Admin updates order status

SHIPPED → Email + tracking link

DELIVERED → Delivery email

CANCELLED → Cancellation email

Customer clicks Track Order and gets redirected to the courier website

Simple, solid, traditional flow — modern power, old-school reliability.

📁 Project Structure
JLRP Clothing E-commerce Platform
│
├── backend/
│   └── app/routers/   → auth, payments, products, orders, dashboard, tracking
│
└── frontend/
    └── src/app/       → shop, admin pages, cart, checkout, track order

⚠️ Note About Friend’s Deal

This project was built for transparent e-commerce, not shady profit splits. The platform supports trusted business flows where price handling is correct and reliable for buyers and admins.

💖 Made with Inscoding
