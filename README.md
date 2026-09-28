# ⚡ TechCore Server — Production E-Commerce & ERP Backend

TechCore Backend is a high-performance Express + MongoDB server designed specifically for computer retail e-commerce in Bangladesh.

---

## 🌟 Key Architecture & Features

1. **Dual DB Engine (MongoDB Atlas + Memory Fallback)**:
   - Connects to MongoDB Atlas when `MONGODB_URI` is provided.
   - Automatically falls back to built-in RAM seed store if offline or initializing, ensuring zero 500 errors on serverless platforms.
2. **Bangladeshi Geography & Logistics**:
   - Division, District, and Upazila database (`bdGeography.js`).
   - Automated delivery fee calculator (Inside/Outside Dhaka, free delivery threshold > ৳10,000 BDT).
   - Real-time Bangladeshi order tracking via Order ID or 11-digit phone number (`01XXXXXXXXX`).
3. **Bangladeshi Payment Gateways**:
   - SSLCommerz integration for bKash, Nagad, Rocket, Upay, Visa, Mastercard, DBBL.
   - EMI installment calculator for 20+ Bangladeshi commercial banks across 3, 6, 9, and 12-month tenures.
4. **PC Builder & Compatibility Engine**:
   - CPU Socket & RAM Type compatibility checks.
   - Form factor clearance checks (ATX, Micro-ATX, Mini-ITX).
   - System TDP wattage & recommended PSU calculator.
   - Performance tier scoring (Gaming score, Editing score, Office score).
   - Printable BDT itemized quotation generator & shareable build links.
5. **Loyalty Reward Points & Flash Sales**:
   - Earn 1 point per ৳100 BDT spent on delivered orders.
   - Server-side coupon validator with category/brand rules.
   - Flash sale campaign management with countdown timers.
6. **Full ERP Admin Panel**:
   - Inventory stock management & restoration hooks on order cancellation.
   - Customer directory with lifetime spend metrics & order counts.
   - ERP analytics dashboard (KPIs, profit breakdown, low stock alerts).
   - Bulk product CSV export & import.

---

## 🚀 Environment Variables Reference (`.env`)

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/techcore?retryWrites=true&w=majority
JWT_SECRET=techcore_super_secret_jwt_key_2026

# SSLCommerz Payment Gateway Configuration
SSLCOMMERZ_STORE_ID=techc651f89bd78a10
SSLCOMMERZ_STORE_PASSWORD=techc651f89bd78a10@ssl
SSLCOMMERZ_IS_LIVE=false

# Stripe Payment Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Cloudinary Storage Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=support@techcore.com.bd
SMTP_PASS=your_app_password

# Client Base URL
CLIENT_URL=http://localhost:3000
```

---

## 💻 Local Development Setup

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Server will start on `http://localhost:5000`.

---

## 🗄️ Database Seed & Category Migration

To populate the 4-level category hierarchy and brand catalog into MongoDB Atlas:

```bash
node src/scripts/migrateCategoriesAndBrands.js
```

---

## ☁️ Deploying to Vercel

1. Push code to GitHub repository.
2. Link repository to Vercel project.
3. Configure `Root Directory` to `server`.
4. Add Environment Variables (`MONGODB_URI`, `JWT_SECRET`, `SSLCOMMERZ_STORE_ID`, etc.) in **Vercel Settings → Environment Variables**.
5. Deploy! `vercel.json` will automatically route all requests to `src/server.js`.
