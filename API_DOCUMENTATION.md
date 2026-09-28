# TechCore Server — Complete API Documentation & Specification

TechCore Backend is a production-grade Bangladeshi tech e-commerce & ERP backend powered by **Node.js, Express, and MongoDB Atlas**, designed for seamless deployment on Vercel Serverless Functions with zero-downtime memory fallbacks.

---

## 🔑 Authentication & Security
- **Authentication**: Stateless JSON Web Tokens (JWT) passed via HTTP Header: `Authorization: Bearer <TOKEN>`.
- **Main Super Admin**: `techcoreadmin@gmail.com`
- **Rate Limiting**:
  - Authentication endpoints (`/api/auth/*`): 20 requests per 15 minutes per IP.
  - Checkout/Order endpoints (`/api/orders`): 30 requests per hour per IP.
- **CORS & Security**: Permissive CORS headers configured for production web client integration alongside Content Security Policy (CSP) headers.

---

## 🏷️ Category & Brand Architecture (Phase 1 & 2)

### `GET /api/categories`
Returns 4-tier hierarchical category tree (Primary → Sub → Child → Tier 4) with product counts and slugs.

### `GET /api/categories/slug/:slug`
Fetches category details by URL slug including parent breadcrumbs and child categories.

### `GET /api/brands`
Returns all active brands with logos, exclusive distribution badges, and SEO metadata.

### `GET /api/brands/grouped`
Returns A–Z index grouped list of all brands for directory browsing (*e.g., A: ASUS, Apple; B: Biostar...*).

### `POST /api/admin/categories` (Admin)
Creates a new category. Supports nested parent binding and order positioning.

### `POST /api/admin/brands` (Admin)
Creates a brand doc with logo, banner, and distributor metadata.

---

## 📦 Products & Catalog Management (Phase 1 & 2)

### `GET /api/products`
Query parameters:
- `page` (default 1), `limit` (default 20)
- `category` (category slug or ID)
- `brand` (brand slug or ID)
- `search` (keyword search against name, tags, SKU, description)
- `minPrice`, `maxPrice` (price range filter)
- `inStock` (`true` for stock > 0)
- `emi` (`true` for EMI eligible items)
- `sort` (`price_asc`, `price_desc`, `newest`, `rating`)

### `GET /api/products/:id` or `GET /api/products/slug/:slug`
Returns complete product details, specifications map, stock status, official warranty info, category & brand populate, and customer rating summaries.

### `GET /api/products/:id/quick-view`
Optimized lightweight product card payload for modal previews.

---

## ⚡ Offers, Flash Sales & Loyalty Points (Phase 3 & 4)

### `GET /api/offers/flash-sale`
Returns active Flash Sale campaign with live countdown timer (`endAt`) and discounted products.

### `POST /api/coupons/validate`
Server-side coupon validation API. Checks minimum order amount, validity date range, usage limit, and per-user limits.
- **Sample Body**: `{ "code": "TECHCORE1000", "subtotal": 25000, "userId": "..." }`

### `GET /api/reward-points/balance`
Retrieves customer's accumulated loyalty reward points balance.
- **Earn Rate**: 1 Point for every ৳100 BDT spent on delivered orders.
- **Redemption**: 1 Point = ৳1 BDT direct discount at checkout.

---

## 🖥️ PC Builder & Interactive Compatibility Engine (Phase 7)

### `POST /api/builder/check`
Evaluates CPU socket compatibility, RAM type matching, form factor clearance, system TDP, and computes Performance Tier Scores (`gamingScore`, `editingScore`, `officeScore`, performance label).

### `POST /api/builder/save`
Saves custom PC build configuration to database. Generates unique shareId (`pc-7k9x2m4p`) and return shareable link.

### `GET /api/builder/share/:shareId`
Retrieves a saved custom PC configuration by share link.

### `GET /api/builder/quotation/:shareId`
Generates a printable itemized BDT quotation JSON payload with store branding, itemized component prices, 5% estimated VAT breakdown, warranty terms, and validity date.

### `POST /api/builder/add-to-cart`
Converts custom PC build components into a formatted list of cart items ready for checkout.

---

## 🚚 Shipping, SSLCommerz & Real-Time Tracking (Phase 5)

### `GET /api/delivery/calculate`
Calculates delivery charge based on Bangladeshi geography:
- **Inside Dhaka**: ৳60 BDT
- **Outside Dhaka**: ৳120 BDT
- **Free Shipping Threshold**: Orders over ৳10,000 BDT

### `POST /api/payment/sslcommerz/init`
Initiates SSLCommerz payment gateway session for bKash, Nagad, Rocket, Visa, Mastercard, and DBBL Cards.

### `GET /api/orders/track`
Real-time Bangladeshi order tracking API by Order ID or Customer Phone (`01XXXXXXXXX`). Returns status history timeline (*PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED*), courier name, and tracking number.

### `POST /api/emi/calculate`
Calculates monthly EMI installment payments across 20+ Bangladeshi partner banks (*BRAC, City Bank, Eastern Bank, DBBL, Standard Chartered*) for 3, 6, 9, or 12 month tenures.

---

## 📄 Static Content, Branch Outlets & Contact Form (Phase 6)

### `GET /api/pages/:slug`
Fetches CMS static policy page content (`about`, `privacy-policy`, `terms-and-conditions`, `refund-policy`, `delivery-policy`, `point-policy`).

### `GET /api/outlets`
Returns list of physical retail branches (*IDB Bhaban Main Branch, Multiplan Center, Uttara, Chittagong Agrabad*) with Google Maps coordinates and operating hours.

### `POST /api/contact`
Submits contact form message and dispatches email notification to support care team.

---

## 📊 Admin Panel & ERP Operations (Phase 8)

### `GET /api/admin/customers`
Paginated customer directory with order count, total BDT spent, reward points balance, and account status filter.

### `GET /api/admin/analytics`
Enriched ERP analytics with date range filter (`period=7d|30d|90d|year|all`). Returns total sales revenue, net profit, low stock count, low stock alert list, and order status breakdown.

### `GET /api/admin/products/export-csv`
Exports full product catalog to RFC-4180 standard CSV file.

### `POST /api/admin/products/import-csv`
Bulk imports or updates products from CSV rows or JSON array with SKU matching and automatic slug generation.
