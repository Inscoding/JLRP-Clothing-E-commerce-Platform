cd ~/Desktop/jlrp-brand-world

echo "# JLRP Clothing E-commerce Platform 👕📦

## Features
- Product listing & checkout
- Razorpay payments
- Admin dashboard to update order status
- Customer tracking page (no login required)
- Integration-ready for Shiprocket/Delhivery

## Folder Structure
\`\`\`
├── backend  # FastAPI + MongoDB + Emails
└── frontend # Next.js Admin + Shop + Tracking UI
\`\`\`

## Local Setup
1. Backend:
\`\`\`bash
cd backend
uvicorn app.main:app --reload
\`\`\`
2. Frontend:
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Tracking
Orders can be tracked via:
\`\`\`
/track?orderId=<order_id>
\`\`\`

Built with ❤️ by a brother.
" > README.md
