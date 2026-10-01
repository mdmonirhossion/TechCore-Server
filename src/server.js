import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  throw new Error('JWT_SECRET environment variable is required.');
}
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';

import { connectDB, getLastMongoError } from './config/db.js';
import cloudinary from './config/cloudinary.js';
import { ProductModel } from './models/Product.js';
import { OrderModel } from './models/Order.js';

import { ServiceRequestModel } from './models/ServiceRequest.js';
import { SupplierModel } from './models/Supplier.js';
import { WarrantyClaimModel } from './models/WarrantyClaim.js';
import { WarrantyModel } from './models/Warranty.js';

import { UserModel } from './models/User.js';
import { verifyToken, requireApprovedAdmin, requireSuperAdmin } from './middleware/auth.js';

import { CategoryModel } from './models/Category.js';
import { BrandModel } from './models/Brand.js';
import { BlogModel } from './models/Blog.js';
import { FaqModel } from './models/Faq.js';
import { HomeSEOModel } from './models/HomeSEO.js';
import { SlugRedirectModel } from './models/SlugRedirect.js';
import { BannerModel } from './models/Banner.js';
import { WishlistModel } from './models/Wishlist.js';
import { ReviewModel } from './models/Review.js';
import { ProductQaModel } from './models/ProductQa.js';
import { PasswordResetModel } from './models/PasswordReset.js';
import { OfferModel } from './models/Offer.js';
import { CouponModel } from './models/Coupon.js';
import { CouponUsageModel } from './models/CouponUsage.js';
import { PointTransactionModel } from './models/PointTransaction.js';
import { DeliveryRuleModel } from './models/DeliveryRule.js';
import { bdDivisions, bdDistrictsMap, bdUpazilasMap } from './services/bdGeography.js';
import { initSSLCommerzPayment, validateSSLCommerzTransaction } from './services/sslcommerzService.js';
import { emiBanksList, calculateEmiInstallment } from './services/emiService.js';
import { StaticPageModel } from './models/StaticPage.js';
import { OutletModel } from './models/Outlet.js';
import { ContactMessageModel } from './models/ContactMessage.js';
import { BuildModel } from './models/Build.js';
import { sendContactFormNotificationEmail } from './services/emailService.js';
import { slugify, generateUniqueSlug } from './utils/slugify.js';
import { runCategoryBrandMigration } from './scripts/migrateCategoriesAndBrands.js';

import { categories, brands, products as initialProducts, sampleServiceRequests, sampleSuppliers } from './data/seedData.js';
import { evaluatePcBuild, calculatePerformanceTier } from './services/compatibilityEngine.js';
import { generateInvoicePdfBuffer } from './services/invoiceService.js';
import { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail, sendPasswordResetEmail } from './services/emailService.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

const clientUrls = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || clientUrls.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiter Memory Store & Middleware
const rateLimitMap = new Map();

const createRateLimiter = ({ windowMs, maxRequests, message }) => {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}_${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests. Please try again later.',
        retryAfterSeconds
      });
    }

    next();
  };
};

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

const orderRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  message: 'Order creation rate limit exceeded. Please wait before placing another order.'
});

// Middleware to ensure DB connection completes before processing any API route (solves Vercel serverless cold-start race conditions)
app.use(async (req, res, next) => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      isMongoConnected = await connectDB();
      if (isMongoConnected) {
        await seedSuperAdmin();
      }
    } catch (e) {
      console.error('Auto DB Connection Middleware Error:', e.message);
    }
  } else if (mongoose.connection.readyState === 1) {
    isMongoConnected = true;
  }
  next();
});

// Root Health & Welcome Route
app.get('/', (req, res) => {
  const active = isMongoActive();
  const dbErr = getLastMongoError();
  res.status(200).json({
    success: true,
    name: 'TechCore Server API',
    status: 'Online ⚡',
    database: {
      connected: active,
      readyState: mongoose.connection.readyState,
      hasEnvVar: Boolean(process.env.MONGODB_URI),
      provider: active ? 'MongoDB Atlas 🍃' : 'In-Memory RAM Store ⚠️',
      diagnosticNotice: active
        ? 'MongoDB Atlas Connected Successfully'
        : (!process.env.MONGODB_URI
            ? 'MONGODB_URI environment variable is missing in Vercel Settings -> Environment Variables'
            : (dbErr || 'MongoDB Atlas IP Whitelist (0.0.0.0/0) or Connection Timeout issue'))
    },
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Silence favicon.ico 404 logs in browser console
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok' });
});

// Chrome DevTools background request handling to silence 404/CSP logs
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ status: 'ok', devtools: true });
});

// Connect to MongoDB Atlas
let isMongoConnected = false;
function isMongoActive() {
  return mongoose.connection.readyState === 1 || isMongoConnected;
}

const seedSuperAdmin = async () => {
  try {
    const mainEmail = process.env.ADMIN_EMAIL;
    const mainPassword = process.env.ADMIN_PASSWORD;

    if (!mainEmail || !mainPassword) {
      console.warn('⚠️ ADMIN_EMAIL or ADMIN_PASSWORD environment variable is missing. Super Admin auto-seeding skipped.');
      return;
    }

    const normalizedEmail = mainEmail.toLowerCase().trim();
    const existingAdmin = await UserModel.findOne({ email: normalizedEmail });
    if (!existingAdmin) {
      console.log(`🕵️‍♂️Seeding Main Super Admin account (${normalizedEmail})...`);
      const hashedPassword = await bcrypt.hash(mainPassword, 10);
      await UserModel.create({
        name: 'TechCore Main Admin',
        email: normalizedEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'APPROVED',
        phone: '+8801700000000'
      });
      console.log(`✅ Main Super Admin account created successfully! (${normalizedEmail})`);
    } else {
      if (existingAdmin.role !== 'SUPER_ADMIN' || existingAdmin.status !== 'APPROVED') {
        existingAdmin.role = 'SUPER_ADMIN';
        existingAdmin.status = 'APPROVED';
        await existingAdmin.save();
        console.log('✅ Main Super Admin privileges verified.');
      }
    }
  } catch (err) {
    console.error('❌ Super Admin Seeding Error:', err.message);
  }
};

connectDB().then(async (connected) => {
  isMongoConnected = connected;
  if (connected) {
    await seedSuperAdmin();
    // Seed initial products to MongoDB Atlas if database is empty
    try {
      const count = await ProductModel.countDocuments();
      if (count < initialProducts.length) {
        console.log('🌱 Syncing expanded product catalog to MongoDB Atlas collection...');
        for (const prod of initialProducts) {
          await ProductModel.findOneAndUpdate(
            { slug: prod.slug },
            { $set: prod },
            { upsert: true, new: true }
          );
        }
        const updatedCount = await ProductModel.countDocuments();
        console.log(`✅ Products successfully synced to MongoDB Atlas! Total: ${updatedCount}`);
      } else {
        console.log(`📦 MongoDB Atlas contains ${count} products.`);
      }
      await runCategoryBrandMigration();
    } catch (err) {
      console.error('Seed/Migration check error:', err.message);
    }
  }
});

// In-Memory Database Store Fallback
let productsStore = [...initialProducts];
let ordersStore = [
  {
    id: 'INV-10045',
    customer: {
      name: 'Tanvir Ahmed',
      email: 'tanvir@gmail.com',
      phone: '01712345678',
      address: 'House 42, Road 11, Banani',
      city: 'Dhaka',
      zone: 'Dhaka Inside'
    },
    items: [
      { productId: 'prod-301', name: 'ASUS Dual GeForce RTX 4060 OC 8GB GDDR6', price: 39999, quantity: 1 }
    ],
    subtotal: 39999,
    discount: 1000,
    deliveryFee: 100,
    grandTotal: 39099,
    paymentMethod: 'bKash',
    paymentStatus: 'Paid',
    orderStatus: 'Processing',
    trackingHistory: [
      { status: 'Pending', time: '2026-09-19 10:00 AM' },
      { status: 'Confirmed', time: '2026-09-19 11:30 AM' },
      { status: 'Processing', time: '2026-09-20 09:15 AM' }
    ],
    createdAt: '2026-09-19'
  }
];
let serviceRequestsStore = [...sampleServiceRequests];
let suppliersStore = [...sampleSuppliers];
let warrantyClaimsStore = [];
let buildsStore = [];
let usersStore = [
  {
    _id: 'usr-101',
    id: 'usr-101',
    name: 'Tanvir Ahmed',
    email: 'tanvir@gmail.com',
    phone: '01712345678',
    role: 'CUSTOMER',
    status: 'APPROVED',
    rewardPoints: 390,
    createdAt: '2026-01-15T10:00:00.000Z'
  },
  {
    _id: 'usr-102',
    id: 'usr-102',
    name: 'Nusrat Jahan',
    email: 'nusrat@yahoo.com',
    phone: '01898765432',
    role: 'CUSTOMER',
    status: 'APPROVED',
    rewardPoints: 120,
    createdAt: '2026-03-20T14:30:00.000Z'
  },
  {
    _id: 'usr-103',
    id: 'usr-103',
    name: 'Sajid Hasan',
    email: 'sajid@outlook.com',
    phone: '01911223344',
    role: 'CUSTOMER',
    status: 'APPROVED',
    rewardPoints: 50,
    createdAt: '2026-05-12T09:15:00.000Z'
  }
];

// -------------------------------------------------------------
// 0. CLOUDINARY FILE / IMAGE UPLOAD API
// -------------------------------------------------------------
app.post('/api/upload', verifyToken, async (req, res) => {
  try {
    const { imageBase64, imageFolder } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: 'No image data provided' });
    }

    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: imageFolder || 'techcore_products'
    });

    res.json({
      url: uploadRes.secure_url,
      publicId: uploadRes.public_id,
      format: uploadRes.format,
      width: uploadRes.width,
      height: uploadRes.height
    });
  } catch (err) {
    console.error('Cloudinary Upload Error:', err);
    res.status(500).json({ message: 'Cloudinary upload failed', error: err.message });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION & ROLE-BASED ACCESS APIS
// -------------------------------------------------------------

// Register User or Request Co-Admin status
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()) {
      return res.status(400).json({ message: 'This email is reserved for the Main Super Admin.' });
    }

    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const requestedRole = role === 'CO_ADMIN' ? 'CO_ADMIN' : 'USER';
    const initialStatus = requestedRole === 'CO_ADMIN' ? 'PENDING' : 'APPROVED';

    const newUser = await UserModel.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: requestedRole,
      status: initialStatus,
      phone
    });

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign({ id: newUser._id, role: newUser.role, email: newUser.email }, jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      message: requestedRole === 'CO_ADMIN'
        ? 'Co-Admin registration submitted! Awaiting Main Admin approval.'
        : 'Registration successful!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        phone: newUser.phone
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// Login API
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = null;

    if (isMongoActive()) {
      user = await UserModel.findOne({ email: normalizedEmail });
    } else {
      user = usersStore.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role === 'CO_ADMIN' && user.status !== 'APPROVED') {
      return res.status(403).json({ message: 'Your Co-Admin account is pending admin approval.' });
    }

    let isMatch = false;
    if (user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: user._id || user.id, role: user.role, email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// Public Order Tracking & Status API (Placed BEFORE GET /api/orders/:id)

// Protected Order Details Endpoint (Requires Order Owner or Admin authentication)

// -------------------------------------------------------------
// 4. WARRANTY & SERVICE APIS
// -------------------------------------------------------------




// Banners & Home Featured Data Endpoints
app.get('/api/banners', async (req, res) => {
  try {
    const { position } = req.query;
    const query = { isActive: true };
    if (position) query.position = position;

    let bannerList = [];
    if (isMongoActive()) {
      bannerList = await BannerModel.find(query).sort({ order: 1 }).lean();
    }

    if (!bannerList || bannerList.length === 0) {
      bannerList = [
        { id: 'b-1', title: 'Ultimate RTX 40 Series Gaming PCs', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1200', position: 'HERO_SLIDER', linkUrl: '/category/gpu' },
        { id: 'b-2', title: 'Next Gen Intel 14th & AMD Ryzen 7000 Processors', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=1200', position: 'HERO_SLIDER', linkUrl: '/category/processor' }
      ];
    }

    res.json(bannerList);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch banners', error: err.message });
  }
});

app.post('/api/admin/banners', requireApprovedAdmin, async (req, res) => {
  try {
    const { title, image, linkUrl, position, order, isActive } = req.body;
    if (!title || !image) return res.status(400).json({ message: 'Title and image URL are required' });

    const banner = await BannerModel.create({
      title,
      image,
      linkUrl: linkUrl || '#',
      position: position || 'HERO_SLIDER',
      order: Number(order) || 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ message: 'Banner creation failed', error: err.message });
  }
});

app.put('/api/admin/banners/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const updated = await BannerModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Banner not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Banner update failed', error: err.message });
  }
});

// Product Data Normalizer Helper
const normalizeProduct = (p) => {
  if (!p) return null;
  const doc = p.toObject ? p.toObject() : p;
  return {
    _id: doc._id || doc.id,
    id: doc.id || (doc._id ? doc._id.toString() : ''),
    name: doc.name || '',
    sku: doc.sku || '',
    brand: doc.brand || 'Generic',
    category: doc.category || 'General',
    categorySlug: doc.categorySlug || (doc.category ? doc.category.toLowerCase().replace(/\s+/g, '-') : 'general'),
    builderCategory: doc.builderCategory || doc.category,
    price: Number(doc.price) || 0,
    discountPrice: doc.discountPrice !== undefined ? Number(doc.discountPrice) : (Number(doc.price) || 0),
    stock: doc.stock !== undefined ? Number(doc.stock) : 10,
    images: Array.isArray(doc.images) && doc.images.length > 0 ? doc.images : ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600'],
    description: doc.description || '',
    specifications: doc.specifications || {},
    warranty: doc.warranty || '3 Years Warranty',
    rating: Number(doc.rating) || 5.0,
    reviewsCount: Number(doc.reviewsCount) || 0,
    isFlashSale: Boolean(doc.isFlashSale),
    flashSalePrice: doc.flashSalePrice ? Number(doc.flashSalePrice) : Number(doc.discountPrice || doc.price || 0),
    slug: doc.slug || (doc.name ? doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'product'),
    stockStatus: doc.stockStatus || (Number(doc.stock) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'),
    emiAvailable: doc.emiAvailable !== undefined ? Boolean(doc.emiAvailable) : true,
    isFeatured: Boolean(doc.isFeatured),
    badge: doc.badge || '',
    keyFeatures: Array.isArray(doc.keyFeatures) ? doc.keyFeatures : [],
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    createdAt: doc.createdAt || new Date().toISOString()
  };
};

// -------------------------------------------------------------
// CATEGORIES, BRANDS, OFFERS & PC BUILDER APIS
// -------------------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    let list = [];
    if (isMongoActive()) {
      try {
        list = await CategoryModel.find().lean();
      } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = categories || [];
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
});

app.get('/api/brands', async (req, res) => {
  try {
    let list = [];
    if (isMongoActive()) {
      try {
        list = await BrandModel.find().lean();
      } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = brands || [];
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch brands', error: err.message });
  }
});

app.get('/api/offers/flash-sale', async (req, res) => {
  try {
    let flashProducts = [];
    if (isMongoActive()) {
      try {
        flashProducts = await ProductModel.find({
          $or: [{ isFlashSale: true }, { flashSalePrice: { $gt: 0 } }]
        }).lean();
      } catch (e) {}
    }
    if (!flashProducts || flashProducts.length === 0) {
      flashProducts = (productsStore || []).filter(p => p.isFlashSale || (p.flashSalePrice && p.flashSalePrice > 0));
    }
    res.json({
      success: true,
      products: flashProducts
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch flash sale offers', error: err.message });
  }
});

app.post('/api/builder/check', (req, res) => {
  try {
    const selectedComponents = req.body.components || req.body || {};
    const evaluation = evaluatePcBuild(selectedComponents);
    res.json({
      success: true,
      compatible: evaluation.isCompatible,
      isCompatible: evaluation.isCompatible,
      issues: evaluation.issues || [],
      errors: (evaluation.issues || []).filter(i => i.severity === 'error'),
      warnings: (evaluation.issues || []).filter(i => i.severity === 'warning'),
      validChecks: evaluation.validChecks || [],
      totalTdp: evaluation.totalTdp || 0,
      recommendedPsuWattage: evaluation.recommendedPsuWattage || 500,
      performanceTier: evaluation.performanceTier || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'PC builder compatibility check failed', error: err.message });
  }
});

app.post('/api/builder/save', async (req, res) => {
  try {
    const buildId = 'BUILD-' + Date.now().toString(36).toUpperCase();
    const buildData = {
      id: buildId,
      buildId: buildId,
      name: req.body.name || req.body.title || 'Custom PC Build',
      components: req.body.components || req.body || {},
      totalPrice: Number(req.body.totalPrice) || 0,
      createdAt: new Date().toISOString()
    };

    let savedBuild = buildData;
    if (isMongoActive()) {
      try {
        savedBuild = await BuildModel.create(buildData);
      } catch (e) {}
    } else {
      buildsStore.push(buildData);
    }

    res.status(201).json({
      success: true,
      buildId: buildId,
      shareUrl: `/pc-builder?id=${buildId}`,
      build: savedBuild
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save PC build', error: err.message });
  }
});

// -------------------------------------------------------------

// -------------------------------------------------------------
// ORDER TRACKING & ORDER DETAIL APIS
// -------------------------------------------------------------
// Public Order Tracking API (GET /api/orders/track?query=...)
app.get('/api/orders/track', async (req, res) => {
  try {
    const queryStr = req.query.query || req.query.orderId || req.query.phone || '';
    const searchVal = String(queryStr).trim();

    if (!searchVal) {
      return res.status(400).json({
        success: false,
        message: 'অর্ডার আইডি বা ফোন নম্বর প্রদান করুন / Please provide an Order ID or Phone number.'
      });
    }

    let order = null;
    const isPhoneQuery = /^01[3-9]\d{8}$/.test(searchVal);

    if (isMongoActive()) {
      if (isPhoneQuery) {
        order = await OrderModel.findOne({ 'customer.phone': searchVal }).sort({ createdAt: -1 }).lean();
      } else {
        order = await OrderModel.findOne({
          $or: [
            { id: searchVal },
            { invoiceNo: searchVal },
            { id: searchVal.toUpperCase() },
            { invoiceNo: searchVal.toUpperCase() }
          ]
        }).lean();
      }
    }

    if (!order) {
      if (isPhoneQuery) {
        order = ordersStore.find(o => o.customer?.phone === searchVal);
      } else {
        order = ordersStore.find(o =>
          (o.id && (o.id === searchVal || o.id === searchVal.toUpperCase())) ||
          (o.invoiceNo && (o.invoiceNo === searchVal || o.invoiceNo === searchVal.toUpperCase()))
        );
      }
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'অর্ডার পাওয়া যায়নি। সঠিক অর্ডার আইডি বা ফোন নম্বর দিয়ে আবার চেষ্টা করুন / Order not found. Please check your order ID or phone number.'
      });
    }

    // Public tracking returns ONLY status & non-sensitive delivery fields (NO phone/address)
    res.json({
      success: true,
      id: order.id || order.invoiceNo,
      invoiceNo: order.invoiceNo || order.id,
      orderStatus: order.orderStatus || 'PENDING',
      paymentStatus: order.paymentStatus || 'Unpaid',
      paymentMethod: order.paymentMethod || 'COD',
      grandTotal: order.grandTotal || 0,
      courier: order.courier || order.courierPartner || 'Steadfast Courier',
      trackingNumber: order.trackingNumber || '',
      statusHistory: order.statusHistory || order.trackingHistory || [],
      createdAt: order.createdAt || new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Order tracking failed on server',
      error: err.message
    });
  }
});

// Protected Get Order By ID API (GET /api/orders/:id)
// Only order owner (token matching user/email) or admin can view full details
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;

    if (isMongoActive()) {
      order = await OrderModel.findOne({
        $or: [{ id }, { invoiceNo: id }, { id: id.toUpperCase() }]
      }).lean();
    }
    if (!order) {
      order = ordersStore.find(o => o.id === id || o.invoiceNo === id || o.id === id.toUpperCase());
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'অর্ডার পাওয়া যায়নি / Order not found' });
    }

    let isAuthorized = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        if (process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded) {
            if (['SUPER_ADMIN', 'CO_ADMIN', 'ADMIN'].includes(decoded.role)) {
              isAuthorized = true;
            } else if (
              (decoded.id && order.user && (order.user.toString() === decoded.id.toString() || order.user._id?.toString() === decoded.id.toString())) ||
              (decoded.email && order.customer?.email && order.customer.email.toLowerCase() === decoded.email.toLowerCase())
            ) {
              isAuthorized = true;
            }
          }
        }
      } catch (e) {}
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Detailed order information is private to the order owner.'
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch order error', error: err.message });
  }
});


// PRODUCTS CATALOG & SEARCH APIS
// -------------------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const { category, brand, search, minPrice, maxPrice, inStock, emi, sort, isFlashSale, isFeatured } = req.query;

    const mongoQuery = {};

    if (category) {
      const catLower = category.toLowerCase().trim();
      mongoQuery.$or = [
        { categorySlug: catLower },
        { category: new RegExp(`^${category}$`, 'i') }
      ];
    }

    if (brand) {
      mongoQuery.brand = new RegExp(`^${brand}$`, 'i');
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions = [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
        { sku: searchRegex }
      ];
      if (mongoQuery.$or) {
        mongoQuery.$and = [
          { $or: mongoQuery.$or },
          { $or: searchConditions }
        ];
        delete mongoQuery.$or;
      } else {
        mongoQuery.$or = searchConditions;
      }
    }

    if (minPrice || maxPrice) {
      mongoQuery.price = {};
      if (minPrice) mongoQuery.price.$gte = Number(minPrice);
      if (maxPrice) mongoQuery.price.$lte = Number(maxPrice);
    }

    if (inStock === 'true') {
      mongoQuery.$or = [
        { stock: { $gt: 0 } },
        { stockStatus: 'IN_STOCK' }
      ];
    }

    if (emi === 'true') {
      mongoQuery.emiAvailable = true;
    }

    if (isFlashSale === 'true') {
      mongoQuery.isFlashSale = true;
    }

    if (isFeatured === 'true') {
      mongoQuery.isFeatured = true;
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    else if (sort === 'price_desc') sortOptions = { price: -1 };
    else if (sort === 'rating') sortOptions = { rating: -1 };
    else if (sort === 'newest') sortOptions = { createdAt: -1 };

    let totalProducts = 0;
    let rawProducts = [];

    if (isMongoActive()) {
      totalProducts = await ProductModel.countDocuments(mongoQuery);
      rawProducts = await ProductModel.find(mongoQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // In-memory fallback if MongoDB is empty or disconnected
    if (rawProducts.length === 0 && !isMongoActive()) {
      let filtered = [...productsStore];
      if (category) filtered = filtered.filter(p => (p.categorySlug === category.toLowerCase() || p.category.toLowerCase() === category.toLowerCase()));
      if (brand) filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
      if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

      totalProducts = filtered.length;
      rawProducts = filtered.slice(skip, skip + limit);
    }

    const products = rawProducts.map(normalizeProduct);

    res.json({
      success: true,
      count: products.length,
      totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit) || 1,
      products
    });
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: err.message });
  }
});

app.get('/api/products/slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    let product = null;

    if (isMongoActive()) {
      product = await ProductModel.findOne({ slug }).lean();
    }

    if (!product) {
      product = productsStore.find(p => p.slug === slug);
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: normalizeProduct(product) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch product by slug error', error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (isMongoActive()) {
      product = await ProductModel.findOne({
        $or: [
          { id },
          { slug: id.toLowerCase() },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : [])
        ]
      }).lean();
    }

    if (!product) {
      product = productsStore.find(p => p.id === id || p.slug === id.toLowerCase());
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: normalizeProduct(product) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch product by ID error', error: err.message });
  }
});

app.get('/api/home/featured', async (req, res) => {
  try {
    let allProds = [];
    let heroBanners = [];
    let featuredCategories = [];

    if (isMongoActive()) {
      allProds = await ProductModel.find().lean();
      heroBanners = await BannerModel.find({ isActive: true, position: 'HERO_SLIDER' }).sort({ order: 1 }).lean();
      featuredCategories = await CategoryModel.find({ isFeatured: true, isActive: true }).sort({ order: 1 }).limit(8).lean();
    }

    if (allProds.length === 0) allProds = productsStore;
    const normalized = allProds.map(normalizeProduct);

    const newest = [...normalized].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);
    const bestSelling = [...normalized].sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0)).slice(0, 8);
    const featured = normalized.filter(p => p.isFeatured).slice(0, 8);
    const flashSale = normalized.filter(p => p.isFlashSale).slice(0, 8);

    res.json({
      heroBanners,
      trustStrip: [
        { icon: 'Truck', title: 'Free Shipping', subtitle: 'On orders over ৳10,000 BDT' },
        { icon: 'RotateCcw', title: '7 Days Return', subtitle: 'Easy replacement policy' },
        { icon: 'ShieldCheck', title: '100% Genuine', subtitle: 'Official brand warranty' },
        { icon: 'Headphones', title: 'Expert Support', subtitle: 'Call 16780 (9 AM - 9 PM)' }
      ],
      featuredCategories,
      tabs: {
        newest,
        bestSelling,
        featured: featured.length > 0 ? featured : newest,
        flashSale: flashSale.length > 0 ? flashSale : newest.slice(0, 4)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load home featured data', error: err.message });
  }
});

app.get('/api/products/:id/quick-view', async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;
    if (isMongoActive()) {
      product = await ProductModel.findOne({ id }).lean();
    }
    if (!product) {
      product = productsStore.find(p => p.id === id);
    }
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const norm = normalizeProduct(product);
    res.json({
      id: norm.id,
      name: norm.name,
      slug: norm.slug,
      brand: norm.brand,
      category: norm.category,
      price: norm.price,
      discountPrice: norm.discountPrice,
      stock: norm.stock,
      stockStatus: norm.stockStatus,
      images: norm.images,
      specifications: norm.specifications,
      warranty: norm.warranty,
      rating: norm.rating,
      reviewsCount: norm.reviewsCount,
      emiAvailable: norm.emiAvailable
    });
  } catch (err) {
    res.status(500).json({ message: 'Quick view fetch error', error: err.message });
  }
});

// Wishlist Endpoints
app.get('/api/wishlist', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    let wishlist = null;
    if (isMongoActive()) {
      wishlist = await WishlistModel.findOne({ user: userId }).lean();
    }

    const productIds = wishlist ? wishlist.productIds : [];
    let items = [];
    if (productIds.length > 0) {
      if (isMongoActive()) {
        items = await ProductModel.find({ id: { $in: productIds } }).lean();
      } else {
        items = productsStore.filter(p => productIds.includes(p.id));
      }
    }

    res.json({ productIds, items: items.map(normalizeProduct) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wishlist', error: err.message });
  }
});

app.post('/api/wishlist/toggle', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: 'productId is required' });

    if (isMongoActive()) {
      let wishlist = await WishlistModel.findOne({ user: userId });
      if (!wishlist) {
        wishlist = new WishlistModel({ user: userId, productIds: [productId] });
      } else {
        const idx = wishlist.productIds.indexOf(productId);
        if (idx > -1) {
          wishlist.productIds.splice(idx, 1);
        } else {
          wishlist.productIds.push(productId);
        }
      }
      await wishlist.save();
      return res.json({ message: 'Wishlist updated', productIds: wishlist.productIds });
    }

    res.json({ message: 'Wishlist updated (memory mode)', productIds: [productId] });
  } catch (err) {
    res.status(500).json({ message: 'Wishlist toggle failed', error: err.message });
  }
});

app.post('/api/wishlist/sync', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productIds = [] } = req.body;

    if (isMongoActive() && Array.isArray(productIds)) {
      let wishlist = await WishlistModel.findOne({ user: userId });
      if (!wishlist) {
        wishlist = new WishlistModel({ user: userId, productIds: Array.from(new Set(productIds)) });
      } else {
        const combined = Array.from(new Set([...wishlist.productIds, ...productIds]));
        wishlist.productIds = combined;
      }
      await wishlist.save();
      return res.json({ message: 'Wishlist synced successfully', productIds: wishlist.productIds });
    }

    res.json({ message: 'Wishlist synced', productIds });
  } catch (err) {
    res.status(500).json({ message: 'Wishlist sync failed', error: err.message });
  }
});

// Reviews & Ratings Moderation APIs
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.max(1, parseInt(req.query.limit) || 10);

    let reviews = [];
    let total = 0;

    if (isMongoActive()) {
      total = await ReviewModel.countDocuments({ productId: id, status: 'APPROVED' });
      reviews = await ReviewModel.find({ productId: id, status: 'APPROVED' })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();
    }

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      reviews
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
  }
});

app.post('/api/products/:id/reviews', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating (1-5) and comment are required.' });
    }

    const userId = req.user._id || req.user.id;
    let isVerifiedBuyer = false;

    if (isMongoActive()) {
      const deliveredOrder = await OrderModel.findOne({
        $or: [{ 'customer.email': req.user.email }, { user: userId }],
        orderStatus: 'Delivered',
        'items.productId': id
      }).lean();
      if (deliveredOrder) {
        isVerifiedBuyer = true;
      }

      const review = await ReviewModel.create({
        productId: id,
        user: userId,
        userName: req.user.name || 'Verified Customer',
        userEmail: req.user.email,
        rating: Number(rating),
        comment: comment.trim(),
        isVerifiedBuyer,
        status: 'APPROVED'
      });

      const allApproved = await ReviewModel.find({ productId: id, status: 'APPROVED' }).select('rating').lean();
      if (allApproved.length > 0) {
        const avgRating = allApproved.reduce((sum, r) => sum + r.rating, 0) / allApproved.length;
        await ProductModel.findOneAndUpdate(
          { id },
          { rating: Number(avgRating.toFixed(1)), reviewsCount: allApproved.length }
        );
      }

      return res.status(201).json({ message: 'Review submitted successfully!', review });
    }

    res.status(201).json({ message: 'Review submitted (RAM mode)', review: { productId: id, rating, comment, isVerifiedBuyer } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit review', error: err.message });
  }
});

app.get('/api/admin/reviews', requireApprovedAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    let reviews = [];
    if (isMongoActive()) {
      reviews = await ReviewModel.find(query).sort({ createdAt: -1 }).lean();
    }
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews for admin', error: err.message });
  }
});

app.patch('/api/admin/reviews/:id/status', requireApprovedAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    if (isMongoActive()) {
      const review = await ReviewModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (review) {
        const allApproved = await ReviewModel.find({ productId: review.productId, status: 'APPROVED' }).select('rating').lean();
        const avgRating = allApproved.length > 0 ? (allApproved.reduce((sum, r) => sum + r.rating, 0) / allApproved.length) : 5.0;
        await ProductModel.findOneAndUpdate(
          { id: review.productId },
          { rating: Number(avgRating.toFixed(1)), reviewsCount: allApproved.length }
        );
        return res.json({ message: `Review status updated to ${status}`, review });
      }
    }
    res.status(404).json({ message: 'Review not found' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update review status', error: err.message });
  }
});

// Product Q&A Endpoints
app.get('/api/products/:id/qa', async (req, res) => {
  try {
    const { id } = req.params;
    let qas = [];
    if (isMongoActive()) {
      qas = await ProductQaModel.find({ productId: id, status: 'APPROVED' }).sort({ createdAt: -1 }).lean();
    }
    res.json(qas);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch product Q&A', error: err.message });
  }
});

app.post('/api/products/:id/qa', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, question } = req.body;
    if (!question) return res.status(400).json({ message: 'Question text is required.' });

    if (isMongoActive()) {
      const qa = await ProductQaModel.create({
        productId: id,
        userName: name || 'Customer',
        question: question.trim(),
        status: 'PENDING'
      });
      return res.status(201).json({ message: 'Question submitted! Awaiting TechCore team answer.', qa });
    }

    res.status(201).json({ message: 'Question submitted (RAM mode)' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit question', error: err.message });
  }
});

app.get('/api/admin/qa', requireApprovedAdmin, async (req, res) => {
  try {
    let qas = [];
    if (isMongoActive()) {
      qas = await ProductQaModel.find().sort({ createdAt: -1 }).lean();
    }
    res.json(qas);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch Q&A list', error: err.message });
  }
});

app.patch('/api/admin/qa/:id/answer', requireApprovedAdmin, async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ message: 'Answer text is required' });

    if (isMongoActive()) {
      const qa = await ProductQaModel.findByIdAndUpdate(
        req.params.id,
        {
          answer: answer.trim(),
          answeredBy: req.user.name || 'TechCore Expert',
          answeredAt: new Date(),
          status: 'APPROVED'
        },
        { new: true }
      );
      if (qa) return res.json({ message: 'Question answered and published!', qa });
    }
    res.status(404).json({ message: 'Question not found' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to answer question', error: err.message });
  }
});
// -------------------------------------------------------------
// OFFERS, CAMPAIGNS, COUPONS & REWARD POINTS APIS
// -------------------------------------------------------------
app.get('/api/offers', async (req, res) => {
  try {
    let offers = [];
    if (isMongoActive()) {
      offers = await OfferModel.find({ isActive: true }).sort({ startAt: -1 }).lean();
    }

    if (!offers || offers.length === 0) {
      offers = [
        {
          _id: 'off-1',
          title: 'Mega Flash Sale 2026',
          slug: 'mega-flash-sale-2026',
          banner: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1200',
          description: 'Flat discounts on high-end Graphics Cards and Gaming CPUs!',
          startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          type: 'FLASH_SALE',
          isActive: true,
          products: [
            { productId: 'prod-101', campaignPrice: 42500, stockLimit: 20 },
            { productId: 'prod-301', campaignPrice: 38500, stockLimit: 15 }
          ]
        }
      ];
    }

    const now = new Date().getTime();
    const formatted = offers.map(off => {
      const endTime = new Date(off.endAt).getTime();
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      return {
        ...off,
        remainingSeconds,
        isExpired: remainingSeconds === 0
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch offers', error: err.message });
  }
});

app.get('/api/offers/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let offer = null;

    if (isMongoActive()) {
      offer = await OfferModel.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();
    }

    if (!offer && slug === 'mega-flash-sale-2026') {
      offer = {
        _id: 'off-1',
        title: 'Mega Flash Sale 2026',
        slug: 'mega-flash-sale-2026',
        banner: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1200',
        description: 'Flat discounts on high-end Graphics Cards and Gaming CPUs!',
        startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'FLASH_SALE',
        isActive: true,
        products: [
          { productId: 'prod-101', campaignPrice: 42500, stockLimit: 20 },
          { productId: 'prod-301', campaignPrice: 38500, stockLimit: 15 }
        ]
      };
    }

    if (!offer) return res.status(404).json({ message: 'Offer campaign not found' });

    const productIds = (offer.products || []).map(p => p.productId);
    let items = [];

    if (productIds.length > 0) {
      if (isMongoActive()) {
        items = await ProductModel.find({ id: { $in: productIds } }).lean();
      } else {
        items = productsStore.filter(p => productIds.includes(p.id));
      }
    }

    const campaignProductMap = {};
    (offer.products || []).forEach(cp => {
      campaignProductMap[cp.productId] = cp;
    });

    const populatedItems = items.map(p => {
      const norm = normalizeProduct(p);
      const camp = campaignProductMap[p.id];
      return {
        ...norm,
        campaignPrice: camp ? camp.campaignPrice : norm.discountPrice,
        originalDiscountPrice: norm.discountPrice,
        discountPrice: camp ? camp.campaignPrice : norm.discountPrice
      };
    });

    const now = new Date().getTime();
    const endTime = new Date(offer.endAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

    res.json({
      ...offer,
      remainingSeconds,
      isExpired: remainingSeconds === 0,
      productsList: populatedItems
    });
  } catch (err) {
    res.status(500).json({ message: 'Offer fetch error', error: err.message });
  }
});

// Admin Offer CRUD
app.post('/api/admin/offers', requireApprovedAdmin, async (req, res) => {
  try {
    const { title, banner, description, startAt, endAt, type, isActive, products } = req.body;
    if (!title || !startAt || !endAt) {
      return res.status(400).json({ message: 'Title, start date, and end date are required.' });
    }

    const slug = await generateUniqueSlug(OfferModel, title);
    const offer = await OfferModel.create({
      title,
      slug,
      banner: banner || '',
      description: description || '',
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      type: type || 'FLASH_SALE',
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      products: Array.isArray(products) ? products : []
    });

    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ message: 'Offer creation failed', error: err.message });
  }
});

app.put('/api/admin/offers/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const updated = await OfferModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Offer not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Offer update failed', error: err.message });
  }
});

app.delete('/api/admin/offers/:id', requireApprovedAdmin, async (req, res) => {
  try {
    await OfferModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Offer deletion failed', error: err.message });
  }
});

// Coupons & Server-Side Validation
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, subtotal = 0, email } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: 'Coupon code is required.' });

    const normalizedCode = code.toUpperCase().trim();
    let coupon = null;

    if (isMongoActive()) {
      coupon = await CouponModel.findOne({ code: normalizedCode, isActive: true }).lean();
    } else {
      if (normalizedCode === 'TECHCORE500') {
        coupon = {
          code: 'TECHCORE500',
          type: 'FIXED',
          value: 500,
          minOrder: 5000,
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true
        };
      } else if (normalizedCode === 'TECH10') {
        coupon = {
          code: 'TECH10',
          type: 'PERCENT',
          value: 10,
          minOrder: 10000,
          maxDiscount: 2000,
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true
        };
      }
    }

    if (!coupon) {
      return res.status(400).json({ valid: false, message: 'Invalid or inactive coupon code.' });
    }

    const now = new Date();
    if (new Date(coupon.validTo) < now || (coupon.validFrom && new Date(coupon.validFrom) > now)) {
      return res.status(400).json({ valid: false, message: 'This coupon code has expired.' });
    }

    if (Number(subtotal) < coupon.minOrder) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order total of ৳${coupon.minOrder.toLocaleString()} BDT is required for this coupon.`
      });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, message: 'Coupon usage limit reached.' });
    }

    if (email && isMongoActive()) {
      const userUsageCount = await CouponUsageModel.countDocuments({
        couponCode: normalizedCode,
        userEmail: email.toLowerCase().trim()
      });
      if (coupon.perUserLimit && userUsageCount >= coupon.perUserLimit) {
        return res.status(400).json({ valid: false, message: `You have already used coupon '${normalizedCode}' the maximum allowed times.` });
      }
    }

    let discountAmount = 0;
    if (coupon.type === 'FIXED') {
      discountAmount = coupon.value;
    } else if (coupon.type === 'PERCENT') {
      discountAmount = Math.round((Number(subtotal) * coupon.value) / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    res.json({
      valid: true,
      code: coupon.code,
      discountAmount,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder
      },
      message: `Coupon '${coupon.code}' applied! Discount: ৳${discountAmount.toLocaleString()} BDT`
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Coupon validation error', error: err.message });
  }
});

// Admin Coupon CRUD
app.get('/api/admin/coupons', requireApprovedAdmin, async (req, res) => {
  try {
    let coupons = [];
    if (isMongoActive()) {
      coupons = await CouponModel.find().sort({ createdAt: -1 }).lean();
    }
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', error: err.message });
  }
});

app.post('/api/admin/coupons', requireApprovedAdmin, async (req, res) => {
  try {
    const { code, type, value, minOrder, maxDiscount, usageLimit, perUserLimit, validTo } = req.body;
    if (!code || value === undefined || !validTo) {
      return res.status(400).json({ message: 'Coupon code, value, and expiration date are required.' });
    }

    const coupon = await CouponModel.create({
      code: code.toUpperCase().trim(),
      type: type || 'FIXED',
      value: Number(value),
      minOrder: Number(minOrder) || 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      perUserLimit: Number(perUserLimit) || 1,
      validTo: new Date(validTo),
      isActive: true
    });

    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Coupon creation failed', error: err.message });
  }
});

app.put('/api/admin/coupons/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const updated = await CouponModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Coupon not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Coupon update failed', error: err.message });
  }
});

app.delete('/api/admin/coupons/:id', requireApprovedAdmin, async (req, res) => {
  try {
    await CouponModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Coupon deletion failed', error: err.message });
  }
});

// Reward Points System
app.get('/api/account/points', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    let userDoc = null;
    let history = [];

    if (isMongoActive()) {
      userDoc = await UserModel.findById(userId).select('rewardPoints').lean();
      history = await PointTransactionModel.find({ user: userId }).sort({ createdAt: -1 }).lean();
    }

    const rewardPoints = userDoc ? (userDoc.rewardPoints || 0) : 0;
    res.json({
      rewardPoints,
      pointValueBdt: 1,
      history
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reward points', error: err.message });
  }
});

app.post('/api/points/redeem-check', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { pointsToRedeem = 0, subtotal = 0 } = req.body;

    let userDoc = null;
    if (isMongoActive()) {
      userDoc = await UserModel.findById(userId).select('rewardPoints').lean();
    }

    const currentPoints = userDoc ? (userDoc.rewardPoints || 0) : 0;
    const requested = Math.max(0, parseInt(pointsToRedeem) || 0);

    if (requested > currentPoints) {
      return res.status(400).json({
        valid: false,
        message: `Insufficient reward points balance. You have ${currentPoints} points available.`
      });
    }

    const discountAmount = Math.min(requested, Number(subtotal));

    res.json({
      valid: true,
      pointsRedeemed: discountAmount,
      discountAmount,
      remainingPoints: currentPoints - discountAmount,
      message: `Redeemed ${discountAmount} points for ৳${discountAmount.toLocaleString()} BDT discount!`
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Points redemption check failed', error: err.message });
  }
});

// -------------------------------------------------------------
// PHASE 5: GEOGRAPHY, DELIVERY RULES, SSLCOMMERZ, EMI & ORDERS
// -------------------------------------------------------------

// BD Geography APIs
app.get('/api/geography/divisions', (req, res) => {
  res.json(bdDivisions);
});

app.get('/api/geography/districts', (req, res) => {
  const { division } = req.query;
  if (division && bdDistrictsMap[division]) {
    return res.json(bdDistrictsMap[division]);
  }
  const allDistricts = Array.from(new Set(Object.values(bdDistrictsMap).flat())).sort();
  res.json(allDistricts);
});

app.get('/api/geography/upazilas', (req, res) => {
  const { district } = req.query;
  if (district && bdUpazilasMap[district]) {
    return res.json(bdUpazilasMap[district]);
  }
  res.json(['Sadar Upazila', 'Central Area', 'Main Market']);
});

// Delivery Charge APIs
app.get('/api/delivery/calculate', async (req, res) => {
  try {
    const { district, subtotal = 0 } = req.query;
    const numericSubtotal = Number(subtotal) || 0;

    let rule = null;
    if (isMongoActive()) {
      rule = await DeliveryRuleModel.findOne().lean();
    }

    const insideFee = rule ? rule.insideDhakaFee : 60;
    const outsideFee = rule ? rule.outsideDhakaFee : 120;
    const freeThreshold = rule ? rule.freeDeliveryThreshold : 10000;

    const isInsideDhaka = district && district.toLowerCase() === 'dhaka';
    let baseFee = isInsideDhaka ? insideFee : outsideFee;

    if (rule && Array.isArray(rule.districtOverrides)) {
      const override = rule.districtOverrides.find(o => o.district.toLowerCase() === (district || '').toLowerCase());
      if (override) baseFee = override.fee;
    }

    const isFree = numericSubtotal >= freeThreshold;
    const finalFee = isFree ? 0 : baseFee;

    res.json({
      deliveryFee: finalFee,
      isFree,
      freeDeliveryThreshold: freeThreshold,
      zone: isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka',
      message: isFree ? 'Congratulations! You unlocked FREE Delivery 🎉' : `Delivery Fee: ৳${finalFee} BDT`
    });
  } catch (err) {
    res.status(500).json({ message: 'Delivery calculation error', error: err.message });
  }
});

app.get('/api/admin/delivery-rules', requireApprovedAdmin, async (req, res) => {
  try {
    let rule = null;
    if (isMongoActive()) {
      rule = await DeliveryRuleModel.findOne().lean();
    }
    if (!rule) {
      rule = { insideDhakaFee: 60, outsideDhakaFee: 120, freeDeliveryThreshold: 10000, districtOverrides: [] };
    }
    res.json(rule);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch delivery rules', error: err.message });
  }
});

app.put('/api/admin/delivery-rules', requireApprovedAdmin, async (req, res) => {
  try {
    const { insideDhakaFee, outsideDhakaFee, freeDeliveryThreshold, districtOverrides } = req.body;
    if (isMongoActive()) {
      const updated = await DeliveryRuleModel.findOneAndUpdate(
        {},
        {
          insideDhakaFee: Number(insideDhakaFee) || 60,
          outsideDhakaFee: Number(outsideDhakaFee) || 120,
          freeDeliveryThreshold: Number(freeDeliveryThreshold) || 10000,
          districtOverrides: Array.isArray(districtOverrides) ? districtOverrides : []
        },
        { new: true, upsert: true }
      ).lean();
      return res.json({ message: 'Delivery rules updated', rule: updated });
    }
    res.json({ message: 'Delivery rules saved (RAM mode)' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update delivery rules', error: err.message });
  }
});

// SSLCommerz Payment Gateway APIs
app.post('/api/payment/sslcommerz/init', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'Order ID is required' });

    let order = null;
    if (isMongoActive()) {
      order = await OrderModel.findOne({ id: orderId }).lean();
    }
    if (!order) {
      order = ordersStore.find(o => o.id === orderId);
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const serverBaseUrl = `${protocol}://${host}`;

    const sslRes = await initSSLCommerzPayment({ order, serverBaseUrl });
    res.json(sslRes);
  } catch (err) {
    res.status(500).json({ message: 'SSLCommerz payment init failed', error: err.message });
  }
});

// -------------------------------------------------------------
// CREATE ORDER API (POST /api/orders)
// -------------------------------------------------------------
app.post('/api/orders', orderRateLimiter, async (req, res) => {
  let reservedItems = [];
  try {
    const { items, customer, paymentMethod, couponCode, district } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required.' });
    }

    if (!customer || !customer.name || !customer.phone || !customer.address) {
      return res.status(400).json({ message: 'Customer name, phone, and address are required.' });
    }

    const phoneTrimmed = String(customer.phone).trim();
    if (!/^01[3-9]\d{8}$/.test(phoneTrimmed)) {
      return res.status(400).json({ message: 'Invalid 11-digit Bangladeshi mobile number format.' });
    }

    const method = String(paymentMethod || 'COD').toUpperCase();
    if (method !== 'COD' && method !== 'SSLCOMMERZ') {
      return res.status(400).json({ message: 'Invalid payment method. Allowed: COD, SSLCOMMERZ.' });
    }

    // Optional Auth User Extraction
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        if (process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.id) userId = decoded.id;
        }
      } catch (e) {}
    }

    // 1. Atomically Check & Reserve Stock, fetch real product prices from DB
    for (const item of items) {
      const pId = item.productId || item.id;
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (!pId) continue;

      let prod = null;
      if (isMongoActive()) {
        prod = await ProductModel.findOneAndUpdate(
          { $or: [{ id: pId }, { slug: pId }], stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { new: true }
        ).lean();
      } else {
        prod = productsStore.find(p => (p.id === pId || p.slug === pId) && p.stock >= qty);
        if (prod) {
          prod.stock -= qty;
        }
      }

      if (!prod) {
        // Rollback reserved stock for previous items in this loop
        for (const r of reservedItems) {
          if (isMongoActive()) {
            await ProductModel.findOneAndUpdate({ id: r.productId }, { $inc: { stock: r.quantity } });
          } else {
            const p = productsStore.find(x => x.id === r.productId);
            if (p) p.stock += r.quantity;
          }
        }
        return res.status(400).json({ message: `Product ${pId} is out of stock or unavailable.` });
      }

      reservedItems.push({
        productId: prod.id || prod._id,
        name: prod.name,
        price: prod.price,
        quantity: qty,
        image: Array.isArray(prod.images) ? prod.images[0] : (prod.image || '')
      });
    }

    if (reservedItems.length === 0) {
      return res.status(400).json({ message: 'No valid items found to order.' });
    }

    // 2. Compute Subtotal
    const subtotal = reservedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // 3. Validate Coupon (Server-Side)
    let couponDiscount = 0;
    if (couponCode && typeof couponCode === 'string') {
      const codeUpper = couponCode.trim().toUpperCase();
      if (isMongoActive()) {
        const cDoc = await CouponModel.findOne({ code: codeUpper, isActive: true }).lean();
        if (cDoc && (!cDoc.expiryDate || new Date(cDoc.expiryDate) > new Date())) {
          if (!cDoc.minOrderAmount || subtotal >= cDoc.minOrderAmount) {
            if (cDoc.discountType === 'PERCENTAGE') {
              couponDiscount = Math.round((subtotal * cDoc.discountPercent) / 100);
              if (cDoc.maxDiscountAmount) couponDiscount = Math.min(couponDiscount, cDoc.maxDiscountAmount);
            } else {
              couponDiscount = cDoc.discountAmount || 0;
            }
          }
        }
      }
    }

    // 4. Calculate Delivery Fee via Delivery Rules
    const targetDistrict = customer.district || district || 'Dhaka';
    const isInsideDhaka = targetDistrict.toLowerCase() === 'dhaka';

    let rule = null;
    if (isMongoActive()) {
      rule = await DeliveryRuleModel.findOne().lean();
    }

    const insideFee = rule ? rule.insideDhakaFee : 60;
    const outsideFee = rule ? rule.outsideDhakaFee : 120;
    const freeThreshold = rule ? rule.freeDeliveryThreshold : 10000;

    let baseFee = isInsideDhaka ? insideFee : outsideFee;
    if (rule && Array.isArray(rule.districtOverrides)) {
      const override = rule.districtOverrides.find(o => o.district.toLowerCase() === targetDistrict.toLowerCase());
      if (override) baseFee = override.fee;
    }

    const deliveryFee = subtotal >= freeThreshold ? 0 : baseFee;
    const grandTotal = Math.max(0, subtotal - couponDiscount) + deliveryFee;

    // Price/Stock change detection vs client values
    let priceChanged = false;
    for (const item of items) {
      if (item.price !== undefined && item.price !== null) {
        const rItem = reservedItems.find(r => r.productId === (item.productId || item.id));
        if (rItem && Number(item.price) !== Number(rItem.price)) {
          priceChanged = true;
          break;
        }
      }
    }
    if (req.body.clientTotal && Math.abs(Number(req.body.clientTotal) - grandTotal) > 1) {
      priceChanged = true;
    }

    const priceNotice = priceChanged
      ? `Notice: Product price or stock changed during order placement. Final server-calculated grand total is ৳${grandTotal.toLocaleString()}. / পণ্যের দাম বা স্টকে পরিবর্তন ঘটেছে। সার্ভার প্রস্তুতকৃত চূড়ান্ত মোট মূল্য: ৳${grandTotal.toLocaleString()}।`
      : '';

    // 5. Generate Secure Order ID & Expiration
    const orderId = 'INV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    const orderData = {
      id: orderId,
      invoiceNo: orderId,
      user: userId || null,
      customer: {
        name: String(customer.name).trim(),
        email: customer.email ? String(customer.email).trim() : '',
        phone: phoneTrimmed,
        address: String(customer.address).trim(),
        division: customer.division || 'Dhaka',
        district: targetDistrict,
        upazila: customer.upazila || 'Dhaka Sadar',
        city: targetDistrict,
        zone: isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'
      },
      items: reservedItems,
      subtotal,
      discount: couponDiscount,
      couponDiscount,
      deliveryFee,
      grandTotal,
      priceChanged,
      priceNotice,
      paymentMethod: method,
      paymentStatus: 'Unpaid',
      orderStatus: method === 'SSLCOMMERZ' ? 'PENDING_PAYMENT' : 'PENDING',
      expiresAt: method === 'SSLCOMMERZ' ? new Date(Date.now() + 30 * 60 * 1000) : null,
      statusHistory: [{
        status: method === 'SSLCOMMERZ' ? 'PENDING_PAYMENT' : 'PENDING',
        time: new Date().toLocaleString(),
        note: `Order created via ${method}`
      }]
    };

    // 6. Save Order in DB FIRST (so tran_id matches order in DB)
    let savedOrder = null;
    if (isMongoActive()) {
      savedOrder = await OrderModel.create(orderData);
    } else {
      ordersStore.push(orderData);
      savedOrder = orderData;
    }

    // 7. Payment Method Branching
    if (method === 'COD') {
      // Async emails for COD (non-blocking)
      if (customer.email) {
        sendOrderConfirmationEmail(savedOrder, customer.email).catch(e => console.error('COD confirmation email error:', e.message));
      }
      sendAdminOrderNotificationEmail(savedOrder).catch(e => console.error('Admin order notification error:', e.message));

      return res.status(201).json({
        success: true,
        order: savedOrder,
        grandTotal: savedOrder.grandTotal,
        priceChanged: Boolean(priceChanged),
        priceNotice: priceNotice || ''
      });
    } else if (method === 'SSLCOMMERZ') {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:5000';
      const serverBaseUrl = `${protocol}://${host}`;

      try {
        const sslRes = await initSSLCommerzPayment({ order: savedOrder, serverBaseUrl });
        if (sslRes && sslRes.status === 'SUCCESS' && sslRes.gatewayUrl) {
          return res.status(201).json({
            success: true,
            order: savedOrder,
            gatewayUrl: sslRes.gatewayUrl
          });
        }

        // If SSLCommerz session init returned FAILED, rollback stock and remove order
        console.warn('⚠️ SSLCommerz Init Failed, rolling back order & stock:', sslRes);
        for (const r of reservedItems) {
          if (isMongoActive()) {
            await ProductModel.findOneAndUpdate({ id: r.productId }, { $inc: { stock: r.quantity } });
          } else {
            const p = productsStore.find(x => x.id === r.productId);
            if (p) p.stock += r.quantity;
          }
        }
        if (isMongoActive()) {
          await OrderModel.deleteOne({ id: orderId });
        }
        return res.status(400).json({
          success: false,
          message: sslRes?.message || 'SSLCommerz payment session initiation failed.'
        });
      } catch (sslErr) {
        // Rollback stock and remove order on exception
        for (const r of reservedItems) {
          if (isMongoActive()) {
            await ProductModel.findOneAndUpdate({ id: r.productId }, { $inc: { stock: r.quantity } });
          } else {
            const p = productsStore.find(x => x.id === r.productId);
            if (p) p.stock += r.quantity;
          }
        }
        if (isMongoActive()) {
          await OrderModel.deleteOne({ id: orderId });
        }
        return res.status(500).json({
          success: false,
          message: 'SSLCommerz session error: ' + sslErr.message
        });
      }
    }
  } catch (err) {
    console.error('❌ Create Order Error:', err.message);
    for (const r of reservedItems) {
      try {
        if (isMongoActive()) {
          await ProductModel.findOneAndUpdate({ id: r.productId }, { $inc: { stock: r.quantity } });
        }
      } catch (e) {}
    }
    return res.status(500).json({ success: false, message: 'Failed to create order', error: err.message });
  }
});

app.all('/api/payment/sslcommerz/success', async (req, res) => {
  try {
    const { orderId, val_id, tran_id, amount, currency } = { ...req.query, ...req.body };
    const targetId = orderId || tran_id;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (!targetId) {
      return res.redirect(`${clientUrl}/checkout/fail?reason=missing_order_id`);
    }

    let order = null;
    if (isMongoActive()) {
      order = await OrderModel.findOne({ id: targetId });
    } else {
      order = ordersStore.find(o => o.id === targetId);
    }

    if (!order) {
      console.warn(`SSLCommerz Success: Order #${targetId} not found in DB`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${targetId}&reason=order_not_found`);
    }

    // IDEMPOTENCY CHECK: Do nothing if already Paid
    if (order.paymentStatus === 'Paid') {
      return res.redirect(`${clientUrl}/checkout/success?orderId=${order.id}`);
    }

    if (!val_id) {
      console.warn(`SSLCommerz Success hit without val_id for Order #${targetId}`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${targetId}&reason=missing_val_id`);
    }

    // Validate via val_id with SSLCommerz Validation Server
    const valResult = await validateSSLCommerzTransaction(val_id);
    if (!valResult.isValid) {
      console.warn(`SSLCommerz Validation Failed for val_id ${val_id}`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${targetId}&reason=validation_failed`);
    }

    const valData = valResult.data || {};
    const paidAmount = Number(valData.amount || valData.currency_amount || amount);
    const paidCurrency = String(valData.currency || valData.currency_type || currency || 'BDT').toUpperCase();
    const paidTranId = String(valData.tran_id || tran_id || targetId).trim();
    const expectedAmount = Number(order.grandTotal);

    // Strict Verification: check amount == order.grandTotal, currency == 'BDT', tran_id == order.id
    if (paidTranId !== order.id) {
      console.warn(`SSLCommerz Security Violation: tran_id mismatch. Expected ${order.id}, got ${paidTranId}`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${order.id}&reason=transaction_mismatch`);
    }

    if (paidCurrency !== 'BDT') {
      console.warn(`SSLCommerz Security Violation: Currency mismatch. Expected BDT, got ${paidCurrency}`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${order.id}&reason=currency_mismatch`);
    }

    if (isNaN(paidAmount) || Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.warn(`SSLCommerz Security Violation: Amount mismatch. Expected ${expectedAmount}, got ${paidAmount}`);
      return res.redirect(`${clientUrl}/checkout/fail?orderId=${order.id}&reason=amount_mismatch`);
    }

    // On Success: Set Paid + CONFIRMED and save paymentDetails
    const paymentDetails = {
      valId: val_id,
      tranId: paidTranId,
      cardType: valData.card_type || req.query.card_type || req.body.card_type || 'N/A',
      storeAmount: valData.store_amount || req.query.store_amount || req.body.store_amount,
      bankTranId: valData.bank_tran_id || req.query.bank_tran_id || req.body.bank_tran_id,
      cardIssuer: valData.card_issuer || 'N/A',
      cardBrand: valData.card_brand || 'N/A'
    };

    if (isMongoActive()) {
      order.paymentStatus = 'Paid';
      order.orderStatus = 'CONFIRMED';
      order.paymentDetails = paymentDetails;
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({ status: 'PAID_ONLINE', time: new Date().toLocaleString(), note: 'Payment verified via SSLCommerz' });
      await order.save();
    } else {
      order.paymentStatus = 'Paid';
      order.orderStatus = 'CONFIRMED';
      order.paymentDetails = paymentDetails;
    }

    // Send confirmation emails
    if (order.customer?.email) {
      sendOrderConfirmationEmail(order, order.customer.email).catch(e => console.error('Online confirmation email error:', e.message));
    }
    sendAdminOrderNotificationEmail(order).catch(e => console.error('Online admin notification error:', e.message));

    return res.redirect(`${clientUrl}/checkout/success?orderId=${order.id}`);
  } catch (err) {
    console.error('SSLCommerz success handler error:', err.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(`${clientUrl}/checkout/fail?reason=server_error`);
  }
});

app.all('/api/payment/sslcommerz/fail', async (req, res) => {
  try {
    const { orderId, tran_id } = { ...req.query, ...req.body };
    const targetId = orderId || tran_id;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (targetId) {
      let order = null;
      if (isMongoActive()) {
        order = await OrderModel.findOne({ id: targetId });
      } else {
        order = ordersStore.find(o => o.id === targetId);
      }

      if (order && order.paymentStatus !== 'Paid') {
        if (order.paymentStatus !== 'Failed' && order.orderStatus !== 'CANCELLED') {
          order.paymentStatus = 'Failed';
          order.orderStatus = 'CANCELLED';
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({ status: 'FAILED', time: new Date().toLocaleString(), note: 'Payment failed via SSLCommerz' });
          if (isMongoActive()) await order.save();

          // Restore stock
          for (const item of (order.items || [])) {
            const pId = item.productId || item.id;
            const qty = Number(item.quantity) || 1;
            if (pId && qty > 0) {
              if (isMongoActive()) {
                await ProductModel.findOneAndUpdate({ id: pId }, { $inc: { stock: qty } });
              } else {
                const p = productsStore.find(x => x.id === pId);
                if (p) p.stock += qty;
              }
            }
          }
        }
      }
    }
    res.redirect(`${clientUrl}/checkout/fail?orderId=${targetId || ''}`);
  } catch (err) {
    console.error('SSLCommerz fail handler error:', err.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/checkout/fail`);
  }
});

app.all('/api/payment/sslcommerz/cancel', async (req, res) => {
  try {
    const { orderId, tran_id } = { ...req.query, ...req.body };
    const targetId = orderId || tran_id;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (targetId) {
      let order = null;
      if (isMongoActive()) {
        order = await OrderModel.findOne({ id: targetId });
      } else {
        order = ordersStore.find(o => o.id === targetId);
      }

      if (order && order.paymentStatus !== 'Paid') {
        if (order.paymentStatus !== 'Failed' && order.orderStatus !== 'CANCELLED') {
          order.paymentStatus = 'Failed';
          order.orderStatus = 'CANCELLED';
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({ status: 'CANCELLED', time: new Date().toLocaleString(), note: 'Payment cancelled by user' });
          if (isMongoActive()) await order.save();

          // Restore stock
          for (const item of (order.items || [])) {
            const pId = item.productId || item.id;
            const qty = Number(item.quantity) || 1;
            if (pId && qty > 0) {
              if (isMongoActive()) {
                await ProductModel.findOneAndUpdate({ id: pId }, { $inc: { stock: qty } });
              } else {
                const p = productsStore.find(x => x.id === pId);
                if (p) p.stock += qty;
              }
            }
          }
        }
      }
    }
    res.redirect(`${clientUrl}/checkout/fail?orderId=${targetId || ''}&reason=cancelled`);
  } catch (err) {
    console.error('SSLCommerz cancel handler error:', err.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/checkout/fail?reason=cancelled`);
  }
});

app.post('/api/payment/sslcommerz/ipn', async (req, res) => {
  try {
    const { val_id, tran_id, status } = { ...req.query, ...req.body };
    console.log(`SSLCommerz IPN Notification received for transaction ${tran_id} (Status: ${status})`);

    if (!tran_id) return res.status(400).send('IPN missing tran_id');

    let order = null;
    if (isMongoActive()) {
      order = await OrderModel.findOne({ id: tran_id });
    } else {
      order = ordersStore.find(o => o.id === tran_id);
    }

    if (!order) return res.status(404).send('IPN order not found');

    // IDEMPOTENCY CHECK
    if (order.paymentStatus === 'Paid') {
      return res.status(200).send('IPN already processed for Paid order');
    }

    if ((status === 'VALID' || status === 'VALIDATED') && val_id) {
      const valRes = await validateSSLCommerzTransaction(val_id);
      if (valRes.isValid) {
        const valData = valRes.data || {};
        const paidAmount = Number(valData.amount || valData.currency_amount);
        const paidCurrency = String(valData.currency || valData.currency_type || 'BDT').toUpperCase();
        const paidTranId = String(valData.tran_id || tran_id).trim();
        const expectedAmount = Number(order.grandTotal);

        if (paidTranId === order.id && paidCurrency === 'BDT' && !isNaN(paidAmount) && Math.abs(paidAmount - expectedAmount) <= 0.01) {
          const paymentDetails = {
            valId: val_id,
            tranId: paidTranId,
            cardType: valData.card_type || req.body.card_type || 'N/A',
            storeAmount: valData.store_amount || req.body.store_amount,
            bankTranId: valData.bank_tran_id || req.body.bank_tran_id,
            cardIssuer: valData.card_issuer || 'N/A',
            cardBrand: valData.card_brand || 'N/A'
          };

          if (isMongoActive()) {
            order.paymentStatus = 'Paid';
            order.orderStatus = 'CONFIRMED';
            order.paymentDetails = paymentDetails;
            if (!order.statusHistory) order.statusHistory = [];
            order.statusHistory.push({ status: 'PAID_ONLINE', time: new Date().toLocaleString(), note: 'Payment verified via SSLCommerz IPN' });
            await order.save();
          } else {
            order.paymentStatus = 'Paid';
            order.orderStatus = 'CONFIRMED';
            order.paymentDetails = paymentDetails;
          }

          if (order.customer?.email) {
            sendOrderConfirmationEmail(order, order.customer.email).catch(e => console.error('IPN email error:', e.message));
          }
          sendAdminOrderNotificationEmail(order).catch(e => console.error('IPN admin email error:', e.message));

          return res.status(200).send('IPN payment verified and processed');
        }
      }
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      if (order.paymentStatus !== 'Failed' && order.orderStatus !== 'CANCELLED') {
        order.paymentStatus = 'Failed';
        order.orderStatus = 'CANCELLED';
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status: 'FAILED_IPN', time: new Date().toLocaleString(), note: 'Payment failed via SSLCommerz IPN' });
        if (isMongoActive()) await order.save();

        // Restore stock
        for (const item of (order.items || [])) {
          const pId = item.productId || item.id;
          const qty = Number(item.quantity) || 1;
          if (pId && qty > 0) {
            if (isMongoActive()) {
              await ProductModel.findOneAndUpdate({ id: pId }, { $inc: { stock: qty } });
            } else {
              const p = productsStore.find(x => x.id === pId);
              if (p) p.stock += qty;
            }
          }
        }
      }
      return res.status(200).send('IPN failure processed');
    }

    return res.status(400).send('IPN validation criteria not met');
  } catch (err) {
    console.error('IPN Error:', err.message);
    res.status(500).send('IPN Error');
  }
});

// EMI Calculator APIs
app.get('/api/emi/banks', (req, res) => {
  res.json({
    banks: emiBanksList,
    supportedTenureMonths: [3, 6, 9, 12]
  });
});

app.post('/api/emi/calculate', (req, res) => {
  try {
    const { amount, tenureMonths, bankCode } = req.body;
    if (!amount) return res.status(400).json({ message: 'Amount is required' });

    const calculation = calculateEmiInstallment({ amount, tenureMonths, bankCode });
    res.json(calculation);
  } catch (err) {
    res.status(500).json({ message: 'EMI calculation failed', error: err.message });
  }
});

// Admin Order Status Transition & Stock / Points Hook
app.patch('/api/admin/orders/:id/status', requireApprovedAdmin, async (req, res) => {
  try {
    const { status, courier, trackingNumber, note } = req.body;
    const validStatuses = ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status value' });
    }

    let order = null;
    if (isMongoActive()) {
      order = await OrderModel.findOne({ id: req.params.id });
    }

    if (!order) {
      order = ordersStore.find(o => o.id === req.params.id);
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    if (courier) order.courier = courier;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status,
      time: new Date().toLocaleString(),
      note: note || `Status changed from ${oldStatus} to ${status}`
    });

    if (isMongoActive()) {
      await order.save();
    }

    // Stock Restoration Hook on CANCELLED or RETURNED
    if ((status === 'CANCELLED' || status === 'RETURNED') && oldStatus !== 'CANCELLED' && oldStatus !== 'RETURNED') {
      for (const item of (order.items || [])) {
        if (item.productId && item.quantity > 0) {
          const p = productsStore.find(prod => prod.id === item.productId);
          if (p) p.stock += item.quantity;
          if (isMongoActive()) {
            try {
              await ProductModel.findOneAndUpdate(
                { id: item.productId },
                { $inc: { stock: item.quantity } }
              );
            } catch (e) {}
          }
        }
      }
    }

    // Reward Points Earn Hook on DELIVERED
    if (status === 'DELIVERED' && oldStatus !== 'DELIVERED' && order.user && isMongoActive()) {
      const earnedPoints = Math.floor((order.grandTotal || 0) / 100);
      if (earnedPoints > 0) {
        await UserModel.findByIdAndUpdate(order.user, { $inc: { rewardPoints: earnedPoints } });
        await PointTransactionModel.create({
          user: order.user,
          type: 'EARNED',
          points: earnedPoints,
          amountBdt: earnedPoints,
          orderId: order.id,
          description: `Earned ${earnedPoints} points for delivered order #${order.id}`
        });
      }
    }

    res.json({ message: 'Order status updated successfully', order });
  } catch (err) {
    console.error('Order status update error:', err.message);
    res.status(500).json({ message: 'Failed to update order status', error: err.message });
  }
});

// -------------------------------------------------------------
// PHASE 6: CONTENT PAGES (STATIC PAGES, OUTLETS & CONTACT FORM)
// -------------------------------------------------------------

const seedStaticPagesMap = {
  'about': {
    title: 'About TechCore Bangladesh',
    slug: 'about',
    contentHtml: '<h1>About TechCore</h1><p>TechCore is one of Bangladesh’s premier technology retailers, specializing in desktop PC building, laptops, computer components, and official IT service support.</p>',
    seoTitle: 'About Us | TechCore Bangladesh',
    seoDescription: 'Learn about TechCore Bangladesh, leading tech retailer and custom PC builder.'
  },
  'contact': {
    title: 'Contact Us',
    slug: 'contact',
    contentHtml: '<h1>Contact TechCore</h1><p>Have questions? Reach out to our customer support team or visit any of our physical outlet branches across Bangladesh.</p>',
    seoTitle: 'Contact Us | TechCore BD',
    seoDescription: 'Get in touch with TechCore customer support, hotline, and branch locations.'
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    contentHtml: '<h1>Privacy Policy</h1><p>TechCore values your privacy. We strictly safeguard customer contact numbers, delivery addresses, and transaction details.</p>',
    seoTitle: 'Privacy Policy | TechCore',
    seoDescription: 'Read TechCore customer data protection and privacy terms.'
  },
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    contentHtml: '<h1>Terms and Conditions</h1><p>Welcome to TechCore. By browsing or purchasing from our platform, you agree to our standard sales and service policies.</p>',
    seoTitle: 'Terms and Conditions | TechCore BD',
    seoDescription: 'Official terms of service and website usage rules for TechCore.'
  },
  'refund-policy': {
    title: 'Refund & Return Policy',
    slug: 'refund-policy',
    contentHtml: '<h1>Refund & Return Policy</h1><p>TechCore offers a 7-day replacement warranty for manufacturing defects on eligible products with original package and receipt.</p>',
    seoTitle: 'Refund & Return Policy | TechCore',
    seoDescription: 'Learn about TechCore 7-day return and product replacement terms.'
  },
  'delivery-policy': {
    title: 'Online Delivery Information',
    slug: 'delivery-policy',
    contentHtml: '<h1>Online Delivery Information</h1><p>We deliver across all 64 districts in Bangladesh within 24–72 hours via trusted courier partners with Cash on Delivery options.</p>',
    seoTitle: 'Delivery Information | TechCore',
    seoDescription: 'Worldwide and island-wide delivery charges and shipping times across Bangladesh.'
  },
  'point-policy': {
    title: 'Reward Points Policy',
    slug: 'point-policy',
    contentHtml: '<h1>Reward Points Policy</h1><p>Earn 1 point for every ৳100 BDT spent on delivered orders. Redeem points directly at checkout (1 Point = ৳1 BDT).</p>',
    seoTitle: 'Reward Points Policy | TechCore',
    seoDescription: 'Earn and redeem TechCore customer loyalty reward points on online purchases.'
  }
};

app.get('/api/pages', async (req, res) => {
  try {
    let pages = [];
    if (isMongoActive()) {
      pages = await StaticPageModel.find({ isActive: true }).select('title slug').lean();
    }
    if (!pages || pages.length === 0) {
      pages = Object.values(seedStaticPagesMap).map(p => ({ title: p.title, slug: p.slug }));
    }
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch static pages', error: err.message });
  }
});

app.get('/api/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const targetSlug = slug.toLowerCase().trim();
    let page = null;

    if (isMongoActive()) {
      page = await StaticPageModel.findOne({ slug: targetSlug, isActive: true }).lean();
    }

    if (!page && seedStaticPagesMap[targetSlug]) {
      page = seedStaticPagesMap[targetSlug];
    }

    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: 'Static page fetch error', error: err.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email address, and message are required.' });
    }

    if (isMongoActive()) {
      await ContactMessageModel.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || '',
        subject: subject || 'General Inquiry',
        message: message.trim()
      });
    }

    (async () => {
      try {
        await sendContactFormNotificationEmail({ name, email, phone, subject, message });
      } catch (e) {}
    })();

    res.status(201).json({ message: 'Thank you for contacting TechCore! Your message has been sent to our customer care team.' });
  } catch (err) {
    res.status(500).json({ message: 'Contact submission failed', error: err.message });
  }
});

// Admin Static Pages CRUD
app.post('/api/admin/pages', requireApprovedAdmin, async (req, res) => {
  try {
    const { title, contentHtml, seoTitle, seoDescription } = req.body;
    if (!title || !contentHtml) return res.status(400).json({ message: 'Title and content are required' });

    const slug = await generateUniqueSlug(StaticPageModel, title);
    const page = await StaticPageModel.create({
      title,
      slug,
      contentHtml,
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || '',
      isActive: true
    });
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ message: 'Page creation failed', error: err.message });
  }
});

app.put('/api/admin/pages/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const updated = await StaticPageModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Page not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Page update failed', error: err.message });
  }
});

app.delete('/api/admin/pages/:id', requireApprovedAdmin, async (req, res) => {
  try {
    await StaticPageModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Page deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Page deletion failed', error: err.message });
  }
});

const seedOutletsList = [
  {
    _id: 'out-1',
    name: 'IDB Bhaban Main Branch (Head Office)',
    slug: 'idb-bhaban-main-branch',
    address: 'Shop 304-306, 3rd Floor, BCS Computer City, IDB Bhaban, Agargaon, Dhaka',
    city: 'Dhaka',
    phone: '01700000001',
    email: 'idb@techcore.com',
    openingHours: '10:00 AM - 8:00 PM (Closed on Sunday)',
    latitude: 23.7772,
    longitude: 90.3807,
    googleMapsUrl: 'https://maps.google.com/?q=23.7772,90.3807',
    isHeadOffice: true,
    isActive: true
  },
  {
    _id: 'out-2',
    name: 'Multiplan Center Branch',
    slug: 'multiplan-center-branch',
    address: 'Shop 412, 4th Floor, Multiplan Computer City Center, New Elephant Road, Dhaka',
    city: 'Dhaka',
    phone: '01700000002',
    email: 'multiplan@techcore.com',
    openingHours: '10:00 AM - 8:00 PM (Closed on Tuesday)',
    latitude: 23.7381,
    longitude: 90.3847,
    googleMapsUrl: 'https://maps.google.com/?q=23.7381,90.3847',
    isHeadOffice: false,
    isActive: true
  },
  {
    _id: 'out-3',
    name: 'Uttara Branch',
    slug: 'uttara-branch',
    address: 'Level 4, Tropical Alauddin Tower, Sector 3, Uttara, Dhaka',
    city: 'Dhaka',
    phone: '01700000003',
    email: 'uttara@techcore.com',
    openingHours: '10:00 AM - 8:00 PM (Closed on Wednesday)',
    latitude: 23.8698,
    longitude: 90.3982,
    googleMapsUrl: 'https://maps.google.com/?q=23.8698,90.3982',
    isHeadOffice: false,
    isActive: true
  },
  {
    _id: 'out-4',
    name: 'Chittagong Agrabad Branch',
    slug: 'chittagong-agrabad-branch',
    address: 'Level 2, Akhtar Uz Zaman Center, Agrabad Commercial Area, Chittagong',
    city: 'Chittagong',
    phone: '01700000004',
    email: 'ctg@techcore.com',
    openingHours: '10:00 AM - 8:00 PM (Closed on Friday)',
    latitude: 22.3244,
    longitude: 91.8123,
    googleMapsUrl: 'https://maps.google.com/?q=22.3244,91.8123',
    isHeadOffice: false,
    isActive: true
  }
];

app.get('/api/outlets', async (req, res) => {
  try {
    let outlets = [];
    if (isMongoActive()) {
      outlets = await OutletModel.find({ isActive: true }).sort({ isHeadOffice: -1, name: 1 }).lean();
    }
    if (!outlets || outlets.length === 0) {
      outlets = seedOutletsList;
    }
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch outlet branches', error: err.message });
  }
});

app.get('/api/outlets/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let outlet = null;
    if (isMongoActive()) {
      outlet = await OutletModel.findOne({ slug: slug.toLowerCase(), isActive: true }).lean();
    }
    if (!outlet) {
      outlet = seedOutletsList.find(o => o.slug === slug.toLowerCase());
    }
    if (!outlet) return res.status(404).json({ message: 'Outlet branch not found' });
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ message: 'Outlet fetch error', error: err.message });
  }
});

// Admin Outlets CRUD
app.post('/api/admin/outlets', requireApprovedAdmin, async (req, res) => {
  try {
    const { name, address, city, phone, email, openingHours, latitude, longitude, googleMapsUrl, isHeadOffice } = req.body;
    if (!name || !address || !phone || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Name, address, phone, latitude, and longitude are required.' });
    }

    const slug = await generateUniqueSlug(OutletModel, name);
    const outlet = await OutletModel.create({
      name,
      slug,
      address,
      city: city || 'Dhaka',
      phone,
      email: email || 'support@techcore.com',
      openingHours: openingHours || '10:00 AM - 8:00 PM',
      latitude: Number(latitude),
      longitude: Number(longitude),
      googleMapsUrl: googleMapsUrl || `https://maps.google.com/?q=${latitude},${longitude}`,
      isHeadOffice: Boolean(isHeadOffice),
      isActive: true
    });

    res.status(201).json(outlet);
  } catch (err) {
    res.status(500).json({ message: 'Outlet creation failed', error: err.message });
  }
});

app.put('/api/admin/outlets/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const updated = await OutletModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Outlet not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Outlet update failed', error: err.message });
  }
});

app.delete('/api/admin/outlets/:id', requireApprovedAdmin, async (req, res) => {
  try {
    await OutletModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Outlet deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Outlet deletion failed', error: err.message });
  }
});

// -------------------------------------------------------------
// PHASE 8: ADMIN PANEL EXPANSION APIS (CUSTOMERS, ANALYTICS, BULK CSV)
// -------------------------------------------------------------

function convertProductsToCsv(productsList) {
  const headers = ['id', 'sku', 'name', 'brand', 'category', 'price', 'discountPrice', 'stock', 'warranty', 'tags', 'description'];
  const rows = [headers.join(',')];

  productsList.forEach(p => {
    const row = [
      `"${p.id || p._id || ''}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price !== undefined ? p.price : (p.discountPrice || 0),
      p.discountPrice !== undefined ? p.discountPrice : (p.price || 0),
      p.stock !== undefined ? p.stock : (p.currentStock || 0),
      `"${(p.warranty || '3 Years Warranty').replace(/"/g, '""')}"`,
      `"${(Array.isArray(p.tags) ? p.tags.join(';') : (p.tags || '')).replace(/"/g, '""')}"`,
      `"${(p.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

function parseCsvToProducts(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    if (!matches || matches.length === 0) continue;

    const row = matches.map(val => val.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    const item = {};

    headers.forEach((h, index) => {
      if (row[index] !== undefined) {
        item[h] = row[index];
      }
    });

    if (item.name) {
      item.price = Number(item.price) || Number(item.discountPrice) || 0;
      item.discountPrice = Number(item.discountPrice) || item.price;
      item.stock = parseInt(item.stock, 10) || 0;
      if (item.tags && typeof item.tags === 'string') {
        item.tags = item.tags.split(';').map(t => t.trim()).filter(Boolean);
      }
      items.push(item);
    }
  }
  return items;
}

// 1. Customer List API (with spend metrics, order counts, points)
app.get('/api/admin/customers', requireApprovedAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const search = (req.query.search || '').trim().toLowerCase();
    const statusFilter = req.query.status;

    let allUsers = [...usersStore];
    let allOrders = [...ordersStore];

    if (isMongoActive()) {
      try {
        const query = { role: 'CUSTOMER' };
        if (statusFilter) query.status = statusFilter;
        if (search) {
          query.$or = [
            { name: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
            { phone: new RegExp(search, 'i') }
          ];
        }

        const dbUsers = await UserModel.find(query).select('-password').lean();
        const dbOrders = await OrderModel.find().lean();

        if (dbUsers) allUsers = dbUsers;
        if (dbOrders) allOrders = dbOrders;
      } catch (e) {
        console.error('Mongo customers fetch error, memory fallback:', e.message);
      }
    }

    if (!isMongoActive()) {
      if (search) {
        allUsers = allUsers.filter(u =>
          (u.name && u.name.toLowerCase().includes(search)) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.phone && u.phone.includes(search))
        );
      }
      if (statusFilter) {
        allUsers = allUsers.filter(u => u.status === statusFilter);
      }
    }

    const customerSummaries = allUsers.map(user => {
      const uEmail = (user.email || '').toLowerCase();
      const uPhone = user.phone || '';

      const userOrders = allOrders.filter(o => {
        const cEmail = (o.customer?.email || '').toLowerCase();
        const cPhone = o.customer?.phone || '';
        return (cEmail && cEmail === uEmail) || (cPhone && cPhone === uPhone) || (o.user && String(o.user) === String(user._id || user.id));
      });

      const validOrders = userOrders.filter(o => o.orderStatus !== 'CANCELLED');
      const totalSpent = validOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      const lastOrder = userOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

      return {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || 'N/A',
        role: user.role || 'CUSTOMER',
        status: user.status || 'APPROVED',
        rewardPoints: user.rewardPoints || 0,
        ordersCount: userOrders.length,
        totalSpent,
        lastOrderDate: lastOrder ? (lastOrder.createdAt || new Date().toISOString()) : null,
        registeredAt: user.createdAt || new Date().toISOString()
      };
    });

    const total = customerSummaries.length;
    const startIndex = (page - 1) * limit;
    const paginatedCustomers = customerSummaries.slice(startIndex, startIndex + limit);

    res.json({
      customers: paginatedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Customer List Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch customer list', error: err.message });
  }
});

// Customer Details & Order History API
app.get('/api/admin/customers/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let targetUser = null;
    let userOrders = [];

    if (isMongoActive()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        targetUser = await UserModel.findById(id).select('-password').lean();
      }
      if (!targetUser) {
        targetUser = await UserModel.findOne({ email: id }).select('-password').lean();
      }
    }

    if (!targetUser) {
      targetUser = usersStore.find(u => String(u._id || u.id) === String(id) || u.email === id);
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'Customer account not found' });
    }

    let allOrders = [...ordersStore];
    if (isMongoActive()) {
      const dbOrders = await OrderModel.find().lean();
      if (dbOrders) allOrders = dbOrders;
    }

    const uEmail = (targetUser.email || '').toLowerCase();
    const uPhone = targetUser.phone || '';

    userOrders = allOrders.filter(o => {
      const cEmail = (o.customer?.email || '').toLowerCase();
      const cPhone = o.customer?.phone || '';
      return (cEmail && cEmail === uEmail) || (cPhone && cPhone === uPhone) || (o.user && String(o.user) === String(targetUser._id || targetUser.id));
    });

    const validOrders = userOrders.filter(o => o.orderStatus !== 'CANCELLED');
    const totalSpent = validOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    res.json({
      customer: {
        id: targetUser._id || targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone || 'N/A',
        role: targetUser.role || 'CUSTOMER',
        status: targetUser.status || 'APPROVED',
        rewardPoints: targetUser.rewardPoints || 0,
        ordersCount: userOrders.length,
        totalSpent,
        registeredAt: targetUser.createdAt
      },
      orders: userOrders
    });
  } catch (err) {
    console.error('Customer Detail Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch customer profile', error: err.message });
  }
});

// Update Customer Status / Role API
app.patch('/api/admin/customers/:id/status', requireApprovedAdmin, async (req, res) => {
  try {
    const { status, role } = req.body;
    const { id } = req.params;

    if (role && ['CO_ADMIN', 'SUPER_ADMIN'].includes(role) && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can grant Admin roles' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (role) updateData.role = role;

    if (isMongoActive() && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select('-password').lean();
      if (updated) return res.json({ message: 'Customer account updated in database', customer: updated });
    }

    const idx = usersStore.findIndex(u => String(u._id || u.id) === String(id));
    if (idx !== -1) {
      usersStore[idx] = { ...usersStore[idx], ...updateData };
      return res.json({ message: 'Customer account updated (RAM mode)', customer: usersStore[idx] });
    }

    res.status(404).json({ message: 'Customer account not found' });
  } catch (err) {
    console.error('Customer Status Update Error:', err.message);
    res.status(500).json({ message: 'Failed to update customer account status', error: err.message });
  }
});

// 2. Enhanced Dashboard Analytics API
app.get('/api/admin/analytics', requireApprovedAdmin, async (req, res) => {
  try {
    const { period } = req.query; // 7d, 30d, 90d, year, all
    let allOrders = [...ordersStore];
    let allProducts = [...productsStore];
    let allUsers = [...usersStore];

    if (isMongoActive()) {
      try {
        const dbOrders = await OrderModel.find().lean();
        if (dbOrders && dbOrders.length > 0) allOrders = dbOrders;

        const dbProducts = await ProductModel.find().lean();
        if (dbProducts && dbProducts.length > 0) allProducts = dbProducts;

        const dbUsers = await UserModel.find({ role: 'CUSTOMER' }).lean();
        if (dbUsers && dbUsers.length > 0) allUsers = dbUsers;
      } catch (e) {
        console.error('Mongo analytics fetch error, fallback to memory:', e.message);
      }
    }

    const validOrders = allOrders.filter(o => o.orderStatus !== 'CANCELLED');
    const totalSales = validOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.orderStatus === 'DELIVERED').length;
    const lowStockProducts = allProducts.filter(p => (p.stock !== undefined ? p.stock : (p.currentStock || 0)) <= 5);

    const purchaseCost = Math.round(totalSales * 0.75);
    const grossProfit = Math.round(totalSales * 0.25);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    // Low stock alert item list
    const lowStockAlerts = lowStockProducts.map(p => ({
      id: p.id || p._id,
      name: p.name,
      sku: p.sku || 'N/A',
      stock: p.stock !== undefined ? p.stock : (p.currentStock || 0),
      category: p.category || 'General',
      status: (p.stock <= 0) ? 'OUT_OF_STOCK' : 'LOW_STOCK'
    })).slice(0, 10);

    // Order status breakdown
    const orderStatusBreakdown = {
      PENDING: allOrders.filter(o => o.orderStatus === 'PENDING').length,
      CONFIRMED: allOrders.filter(o => o.orderStatus === 'CONFIRMED').length,
      PROCESSING: allOrders.filter(o => o.orderStatus === 'PROCESSING').length,
      SHIPPED: allOrders.filter(o => o.orderStatus === 'SHIPPED').length,
      DELIVERED: completedOrders,
      CANCELLED: allOrders.filter(o => o.orderStatus === 'CANCELLED').length
    };

    // Top selling products by frequency in orders
    const productSalesMap = {};
    allOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const pid = item.productId || item.name;
        if (!productSalesMap[pid]) {
          productSalesMap[pid] = { productId: pid, name: item.name, quantitySold: 0, totalRevenue: 0 };
        }
        productSalesMap[pid].quantitySold += (item.quantity || 1);
        productSalesMap[pid].totalRevenue += ((item.price || 0) * (item.quantity || 1));
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    res.json({
      period: period || 'all',
      kpis: {
        totalSales,
        totalOrders,
        completedOrders,
        totalCustomers: allUsers.length || 492,
        lowStockCount: lowStockProducts.length,
        revenue: totalSales,
        purchaseCost,
        grossProfit,
        averageOrderValue
      },
      lowStockAlerts,
      orderStatusBreakdown,
      topProducts,
      salesTrend: [
        { month: 'Jan', sales: Math.round(totalSales * 0.12), profit: Math.round(totalSales * 0.03) },
        { month: 'Feb', sales: Math.round(totalSales * 0.15), profit: Math.round(totalSales * 0.04) },
        { month: 'Mar', sales: Math.round(totalSales * 0.14), profit: Math.round(totalSales * 0.035) },
        { month: 'Apr', sales: Math.round(totalSales * 0.20), profit: Math.round(totalSales * 0.05) },
        { month: 'May', sales: Math.round(totalSales * 0.18), profit: Math.round(totalSales * 0.045) },
        { month: 'Jun', sales: Math.round(totalSales * 0.21), profit: Math.round(totalSales * 0.052) }
      ],
      categoryShare: [
        { name: 'Graphics Cards', value: 42 },
        { name: 'Processors', value: 28 },
        { name: 'Laptops', value: 18 },
        { name: 'Motherboards', value: 12 }
      ]
    });
  } catch (err) {
    console.error('Analytics Error:', err.message);
    res.status(500).json({ message: 'Failed to load analytics', error: err.message });
  }
});

// 3. Export Products CSV API
app.get('/api/admin/products/export-csv', requireApprovedAdmin, async (req, res) => {
  try {
    let allProducts = [...productsStore];
    if (isMongoActive()) {
      try {
        const dbProducts = await ProductModel.find().lean();
        if (dbProducts && dbProducts.length > 0) allProducts = dbProducts;
      } catch (e) {
        console.error('Mongo CSV export fetch error, fallback to memory:', e.message);
      }
    }

    const csvContent = convertProductsToCsv(allProducts);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="techcore_products_export.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV Export Error:', err.message);
    res.status(500).json({ message: 'Failed to export products CSV', error: err.message });
  }
});

// 4. Bulk Import Products CSV / JSON API
app.post('/api/admin/products/import-csv', requireApprovedAdmin, async (req, res) => {
  try {
    const { items: rawItems, csvText } = req.body;
    let importList = Array.isArray(rawItems) ? rawItems : [];

    if (importList.length === 0 && csvText) {
      importList = parseCsvToProducts(csvText);
    }

    if (importList.length === 0) {
      return res.status(400).json({ message: 'No valid product rows provided for import.' });
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    for (const item of importList) {
      if (!item.name) {
        errors.push({ item, reason: 'Missing product name' });
        continue;
      }

      const skuVal = item.sku || `TC-SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const priceVal = Number(item.price || item.discountPrice || 0);
      const discountPriceVal = Number(item.discountPrice || item.price || 0);
      const stockVal = parseInt(item.stock, 10) || 0;

      if (isMongoActive()) {
        try {
          const existing = await ProductModel.findOne({
            $or: [{ sku: skuVal }, { name: item.name }]
          });

          if (existing) {
            existing.price = priceVal;
            existing.discountPrice = discountPriceVal;
            existing.stock = stockVal;
            if (item.brand) existing.brand = item.brand;
            if (item.category) existing.category = item.category;
            if (item.warranty) existing.warranty = item.warranty;
            if (item.description) existing.description = item.description;
            await existing.save();
            updatedCount++;
          } else {
            const slug = await generateUniqueSlug(ProductModel, item.name);
            await ProductModel.create({
              id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              sku: skuVal,
              name: item.name,
              slug,
              brand: item.brand || 'Generic',
              category: item.category || 'General',
              price: priceVal,
              discountPrice: discountPriceVal,
              stock: stockVal,
              warranty: item.warranty || '3 Years Warranty',
              description: item.description || `${item.name} original product from TechCore BD.`,
              images: item.images || ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop'],
              tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : [])
            });
            createdCount++;
          }
        } catch (e) {
          errors.push({ item: item.name, reason: e.message });
        }
      } else {
        // RAM store fallback
        const existingIdx = productsStore.findIndex(p => p.sku === skuVal || p.name === item.name);
        if (existingIdx !== -1) {
          productsStore[existingIdx] = {
            ...productsStore[existingIdx],
            price: priceVal,
            discountPrice: discountPriceVal,
            stock: stockVal,
            brand: item.brand || productsStore[existingIdx].brand,
            category: item.category || productsStore[existingIdx].category
          };
          updatedCount++;
        } else {
          const newProd = {
            id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sku: skuVal,
            name: item.name,
            slug: slugify(item.name),
            brand: item.brand || 'Generic',
            category: item.category || 'General',
            price: priceVal,
            discountPrice: discountPriceVal,
            stock: stockVal,
            warranty: item.warranty || '3 Years Warranty',
            images: ['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop']
          };
          productsStore.unshift(newProd);
          createdCount++;
        }
      }
    }

    res.status(200).json({
      message: 'Bulk product import processed successfully',
      totalProcessed: importList.length,
      createdCount,
      updatedCount,
      errorsCount: errors.length,
      errors
    });
  } catch (err) {
    console.error('Bulk Import Error:', err.message);
    res.status(500).json({ message: 'Failed to process bulk import', error: err.message });
  }
});

app.get('/api/admin/inventory', requireApprovedAdmin, async (req, res) => {
  try {
    let allProducts = [...productsStore];
    if (isMongoActive()) {
      try {
        const dbProducts = await ProductModel.find().lean();
        if (dbProducts && dbProducts.length > 0) {
          allProducts = dbProducts;
        }
      } catch (e) {
        console.error('Mongo inventory fetch error, fallback to memory:', e.message);
      }
    }

    const inventory = allProducts.map(p => {
      const stockVal = p.stock !== undefined ? p.stock : (p.currentStock !== undefined ? p.currentStock : 0);
      const imgVal = (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : (p.image || 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop');
      const imgsArr = Array.isArray(p.images) && p.images.length > 0 ? p.images : [imgVal];

      return {
        id: p.id,
        sku: p.sku || 'N/A',
        name: p.name,
        brand: p.brand || 'Generic',
        category: p.category || 'General',
        price: p.price !== undefined ? p.price : (p.discountPrice || 0),
        discountPrice: p.discountPrice !== undefined ? p.discountPrice : (p.price || 0),
        image: imgVal,
        images: imgsArr,
        warranty: p.warranty || '3 Years Warranty',
        stock: stockVal,
        currentStock: stockVal,
        soldCount: p.soldCount !== undefined ? p.soldCount : Math.floor(Math.random() * 40) + 10,
        reservedCount: p.reservedCount !== undefined ? p.reservedCount : Math.floor(Math.random() * 5),
        damagedCount: p.damagedCount !== undefined ? p.damagedCount : 1,
        status: stockVal <= 0 ? 'OUT_OF_STOCK' : (stockVal <= 5 ? 'LOW_STOCK' : 'IN_STOCK')
      };
    });

    res.json(inventory);
  } catch (err) {
    console.error('Inventory list error:', err.message);
    res.status(500).json({ message: 'Failed to fetch inventory', error: err.message });
  }
});

app.patch('/api/admin/inventory/:id', requireApprovedAdmin, async (req, res) => {
  try {
    const { newStock } = req.body;
    const stockNum = Number(newStock);
    if (isNaN(stockNum)) {
      return res.status(400).json({ message: 'Invalid stock value provided.' });
    }

    if (isMongoConnected) {
      try {
        const updated = await ProductModel.findOneAndUpdate(
          { id: req.params.id },
          { stock: stockNum },
          { new: true }
        ).lean();
        if (updated) {
          // Sync with in-memory store
          const idx = productsStore.findIndex(p => p.id === req.params.id);
          if (idx !== -1) productsStore[idx].stock = stockNum;
          return res.json({ message: 'Stock updated successfully in MongoDB', product: normalizeProduct(updated) });
        }
      } catch (e) {
        console.error('Mongo inventory update error:', e.message);
      }
    }

    const prod = productsStore.find(p => p.id === req.params.id);
    if (prod) {
      prod.stock = stockNum;
      return res.json({ message: 'Stock updated', product: normalizeProduct(prod) });
    }
    res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    console.error('Inventory update error:', err.message);
    res.status(500).json({ message: 'Stock update failed', error: err.message });
  }
});

app.get('/api/admin/suppliers', requireApprovedAdmin, async (req, res) => {
  try {
    let suppliers = [];
    if (isMongoActive()) {
      suppliers = await SupplierModel.find().sort({ createdAt: -1 }).lean();
    }
    if (!suppliers || suppliers.length === 0) {
      suppliers = suppliersStore;
    }
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch suppliers', error: err.message });
  }
});

app.post('/api/admin/suppliers', requireApprovedAdmin, async (req, res) => {
  try {
    const supplierId = `sup-${Date.now()}`;
    const supplierData = {
      id: supplierId,
      name: req.body.name || 'Supplier',
      company: req.body.company || req.body.name || 'Company',
      phone: req.body.phone || '',
      email: req.body.email || '',
      category: req.body.category || 'General',
      address: req.body.address || '',
      status: req.body.status || 'ACTIVE'
    };

    let savedSupplier = supplierData;
    if (isMongoActive()) {
      savedSupplier = await SupplierModel.create(supplierData);
    } else {
      suppliersStore.push(supplierData);
    }

    res.status(201).json(savedSupplier);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create supplier', error: err.message });
  }
});

// 404 Fallback JSON Handler for Unmatched Routes (prevents 404 HTML & Vercel live script errors)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found on TechCore Server.`
  });
});

const server = app.listen(PORT, () => {
  console.log(`⚡ TechCore Express Server active on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is currently occupied by another process.`);
    console.log(`🔄 Attempting to listen on fallback port ${Number(PORT) + 1}...`);
    app.listen(Number(PORT) + 1, () => {
      console.log(`⚡ TechCore Express Server active on http://localhost:${Number(PORT) + 1}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

export default app;


// -------------------------------------------------------------
// WARRANTY & SERVICE APIS (MONGOOSE MIGRATED)
// -------------------------------------------------------------
app.get('/api/warranty/check', async (req, res) => {
  try {
    const { serial } = req.query;
    if (!serial) {
      return res.status(400).json({ success: false, message: 'Serial number query is required.' });
    }

    const searchSerial = String(serial).trim().toUpperCase();
    let record = null;

    if (isMongoActive()) {
      record = await WarrantyModel.findOne({ serialNumber: searchSerial }).lean();
    }

    if (!record) {
      // Memory fallback for demo seeds
      if (searchSerial === 'SN-ASUS-9842' || searchSerial === 'SN-INTEL-14700K' || searchSerial === 'SN-4060-TEST') {
        record = {
          serialNumber: searchSerial,
          productName: searchSerial.includes('ASUS') ? 'ASUS Dual GeForce RTX 4060 OC 8GB GDDR6' : 'Intel Core i7-14700K Processor',
          purchaseDate: '2025-10-15',
          expiryDate: '2028-10-15',
          status: 'Active',
          warrantyYears: '3 Years (36 Months)',
          serviceCenter: 'Multiplan Center Branch (Level 4, Shop #408)'
        };
      }
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'অর্ডার / সিরিয়াল নম্বর পাওয়া যায়নি। দয়া করে সঠিক প্রডাক্ট সিরিয়াল নম্বর লিখুন। / Serial number not found in official warranty database.'
      });
    }

    res.json({
      success: true,
      serialNumber: record.serialNumber,
      productName: record.productName,
      purchaseDate: record.purchaseDate || '2025-10-15',
      expiryDate: record.expiryDate || '2028-10-15',
      status: record.status || 'Active',
      warrantyYears: record.warrantyYears || '3 Years',
      serviceCenter: record.serviceCenter || 'Multiplan Center Branch (Level 4, Shop #408)'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Warranty lookup error', error: err.message });
  }
});

app.post('/api/warranty/claim', async (req, res) => {
  try {
    const { serialNumber, productName, customerName, customerPhone, issueDescription } = req.body;
    const claimId = `WC-${Date.now()}`;
    const claimData = {
      id: claimId,
      serialNumber: serialNumber || 'SN-UNKNOWN',
      productName: productName || 'Hardware Component',
      customerName: customerName || 'Customer',
      customerPhone: customerPhone || '',
      issueDescription: issueDescription || '',
      status: 'Claim Received',
      createdAt: new Date().toISOString().split('T')[0]
    };

    let savedClaim = null;
    if (isMongoActive()) {
      savedClaim = await WarrantyClaimModel.create(claimData);
    } else {
      warrantyClaimsStore.push(claimData);
      savedClaim = claimData;
    }

    res.status(201).json({ message: 'Warranty claim submitted successfully', claim: savedClaim });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit warranty claim', error: err.message });
  }
});

app.get('/api/service', async (req, res) => {
  try {
    let requests = [];
    if (isMongoActive()) {
      requests = await ServiceRequestModel.find().sort({ createdAt: -1 }).lean();
    }
    if (!requests || requests.length === 0) {
      requests = serviceRequestsStore;
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch service requests', error: err.message });
  }
});

app.post('/api/service', async (req, res) => {
  try {
    const { name, phone, email, deviceType, issueDescription } = req.body;
    const newReq = {
      id: `SR-${Math.floor(9000 + Math.random() * 1000)}`,
      name: name || 'Customer',
      phone: phone || '',
      email: email || '',
      deviceType: deviceType || 'Desktop PC',
      issueDescription: issueDescription || '',
      status: 'Submitted',
      technician: 'Unassigned',
      createdAt: new Date().toISOString().split('T')[0]
    };

    let savedReq = null;
    if (isMongoActive()) {
      savedReq = await ServiceRequestModel.create(newReq);
    } else {
      serviceRequestsStore.unshift(newReq);
      savedReq = newReq;
    }

    res.status(201).json(savedReq);
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit service request', error: err.message });
  }
});



// -------------------------------------------------------------
// UNPAID ORDER AUTOMATIC CANCELLATION CRON JOB (30-MIN TIMEOUT)
// Protected by CRON_SECRET header
// -------------------------------------------------------------
app.all(['/api/cron/cancel-unpaid-orders', '/api/orders/cron/cancel-expired'], async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const querySecret = req.query.secret;

    if (
      cronSecret &&
      authHeader !== `Bearer ${cronSecret}` &&
      authHeader !== cronSecret &&
      querySecret !== cronSecret
    ) {
      return res.status(401).json({ success: false, message: 'Unauthorized cron request. Invalid CRON_SECRET.' });
    }

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    let cancelledCount = 0;

    if (isMongoActive()) {
      const expiredOrders = await OrderModel.find({
        $or: [
          { orderStatus: 'PENDING_PAYMENT' },
          { paymentStatus: 'Unpaid', orderStatus: 'PENDING' }
        ],
        createdAt: { $lte: thirtyMinsAgo }
      });

      for (const order of expiredOrders) {
        order.orderStatus = 'CANCELLED';
        order.paymentStatus = 'Failed';
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({
          status: 'CANCELLED',
          time: new Date().toLocaleString(),
          note: 'Order automatically cancelled due to 30-minute unpaid payment timeout'
        });
        await order.save();

        // Restore reserved product stock
        for (const item of (order.items || [])) {
          const pId = item.productId || item.id;
          if (pId) {
            await ProductModel.findOneAndUpdate(
              { $or: [{ id: pId }, { slug: pId }] },
              { $inc: { stock: item.quantity } }
            );
          }
        }
        cancelledCount++;
      }
    } else {
      ordersStore.forEach(order => {
        if (
          (order.orderStatus === 'PENDING_PAYMENT' || (order.paymentStatus === 'Unpaid' && order.orderStatus === 'PENDING')) &&
          new Date(order.createdAt || Date.now()) <= thirtyMinsAgo
        ) {
          order.orderStatus = 'CANCELLED';
          order.paymentStatus = 'Failed';
          cancelledCount++;
        }
      });
    }

    res.json({
      success: true,
      message: `Expired unpaid order cancellation job complete. Cancelled ${cancelledCount} order(s).`,
      cancelledCount,
      executedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cron job execution error', error: err.message });
  }
});

