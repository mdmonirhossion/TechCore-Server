import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import cloudinary from './config/cloudinary.js';
import { ProductModel } from './models/Product.js';
import { OrderModel } from './models/Order.js';
import { UserModel } from './models/User.js';
import { verifyToken, requireApprovedAdmin, requireSuperAdmin } from './middleware/auth.js';

import { categories, brands, products as initialProducts, sampleServiceRequests, sampleSuppliers } from './data/seedData.js';
import { evaluatePcBuild } from './services/compatibilityEngine.js';
import { createStripePaymentIntent } from './services/stripeService.js';
import { generateInvoicePdfBuffer } from './services/invoiceService.js';
import { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail } from './services/emailService.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Global Security, CORS & Content Security Policy (CSP) Headers Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' https://vercel.live; connect-src * 'unsafe-inline' https://vercel.live; img-src * data: blob:; style-src * 'unsafe-inline';"
  );
  if (req.method === 'OPTIONS') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ status: 'ok' });
  }
  next();
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
  res.status(200).json({
    success: true,
    name: 'TechCore Server API',
    status: 'Online ⚡',
    database: {
      connected: active,
      readyState: mongoose.connection.readyState,
      provider: active ? 'MongoDB Atlas 🍃' : 'In-Memory RAM Store ⚠️ (Set MONGODB_URI in Vercel settings)'
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

// -------------------------------------------------------------
// STRIPE PAYMENT INTENT API
// -------------------------------------------------------------
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, email } = req.body;
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }

    const intent = await createStripePaymentIntent(amount, email || 'customer@techcore.com');
    res.json({
      success: true,
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error('Stripe Payment Intent Creation Error:', err);
    res.status(500).json({ message: 'Stripe payment creation failed', error: err.message });
  }
});

// Connect to MongoDB Atlas
let isMongoConnected = false;
const isMongoActive = () => mongoose.connection.readyState === 1 || isMongoConnected;

const seedSuperAdmin = async () => {
  try {
    const mainEmail = 'techcoreadmin@gmail.com';
    const existingAdmin = await UserModel.findOne({ email: mainEmail });
    if (!existingAdmin) {
      console.log('👑 Seeding Main Super Admin account (techcoreadmin@gmail.com)...');
      const hashedPassword = await bcrypt.hash('admin890@', 10);
      await UserModel.create({
        name: 'TechCore Main Admin',
        email: mainEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'APPROVED',
        phone: '+8801700000000'
      });
      console.log('✅ Main Super Admin account created successfully! (techcoreadmin@gmail.com)');
    } else {
      const hashedPassword = await bcrypt.hash('admin890@', 10);
      existingAdmin.role = 'SUPER_ADMIN';
      existingAdmin.status = 'APPROVED';
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('✅ Main Super Admin account updated to SUPER_ADMIN & active (techcoreadmin@gmail.com).');
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
      if (count === 0) {
        console.log('🌱 Seeding products to MongoDB Atlas collection...');
        await ProductModel.insertMany(initialProducts);
        console.log('✅ 18 Products successfully seeded to MongoDB Atlas!');
      } else {
        console.log(`📦 MongoDB Atlas contains ${count} products.`);
      }
    } catch (err) {
      console.error('Seed check error:', err.message);
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

// -------------------------------------------------------------
// 0. CLOUDINARY FILE / IMAGE UPLOAD API
// -------------------------------------------------------------
app.post('/api/upload', async (req, res) => {
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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail === 'techcoreadmin@gmail.com') {
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

    const jwtSecret = process.env.JWT_SECRET || 'techcore_super_secret_jwt_key_2026';
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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'techcore_super_secret_jwt_key_2026';
    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '7d' });

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
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

// Get Current User Profile
app.get('/api/auth/me', verifyToken, async (req, res) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// SUPER ADMIN APPROVAL & CO-ADMIN MANAGEMENT APIS
// -------------------------------------------------------------

// Get pending Co-Admin requests (Super Admin Only)
app.get('/api/admin/pending-admins', requireSuperAdmin, async (req, res) => {
  try {
    const pendingAdmins = await UserModel.find({ role: 'CO_ADMIN', status: 'PENDING' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json(pendingAdmins);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending admins', error: err.message });
  }
});

// Get all admins & co-admins (Super Admin Only)
app.get('/api/admin/all-admins', requireSuperAdmin, async (req, res) => {
  try {
    const admins = await UserModel.find({ role: { $in: ['CO_ADMIN', 'SUPER_ADMIN'] } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admins', error: err.message });
  }
});

// Approve Co-Admin (Super Admin Only)
app.patch('/api/admin/approve-admin/:id', requireSuperAdmin, async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { status: 'APPROVED' },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      message: `Co-Admin ${user.name} has been approved! They can now add/edit/delete products.`,
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Approval failed', error: err.message });
  }
});

// Reject Co-Admin (Super Admin Only)
app.patch('/api/admin/reject-admin/:id', requireSuperAdmin, async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { status: 'REJECTED' },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      message: `Co-Admin request for ${user.name} has been rejected.`,
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
});

// -------------------------------------------------------------
// 1. PRODUCTS & CATALOG APIS
// -------------------------------------------------------------
app.get('/api/products', async (req, res) => {
  const { category, brand, minPrice, maxPrice, search, sort } = req.query;

  let filtered = [];

  // If MongoDB is active, fetch from Mongo sorted by newest
  if (isMongoActive()) {
    try {
      const dbProducts = await ProductModel.find().sort({ createdAt: -1 }).lean();
      if (dbProducts && dbProducts.length > 0) {
        filtered = dbProducts;
      }
    } catch (e) {
      console.error('Mongo fetch error, fallback to memory:', e.message);
    }
  }

  // Fallback to in-memory store if Mongo is not connected or returned empty
  if (filtered.length === 0) {
    filtered = [...productsStore];
  }

  if (category) {
    filtered = filtered.filter(p => (p.categorySlug && p.categorySlug === category) || (p.category && p.category.toLowerCase() === category.toLowerCase()));
  }

  if (brand) {
    filtered = filtered.filter(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (minPrice) {
    filtered = filtered.filter(p => (p.discountPrice !== undefined ? p.discountPrice : p.price) >= Number(minPrice));
  }

  if (maxPrice) {
    filtered = filtered.filter(p => (p.discountPrice !== undefined ? p.discountPrice : p.price) <= Number(maxPrice));
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.tags && p.tags.some(t => t && t.toLowerCase().includes(q)))
    );
  }

  if (sort === 'price-low') {
    filtered.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
  } else if (sort === 'price-high') {
    filtered.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
  } else if (sort === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  res.json({
    total: filtered.length,
    products: filtered
  });
});

// Search suggestions & auto-complete multi-field engine
app.get('/api/products/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) {
      return res.json({ products: [], brands: [], categories: [], suggestions: [] });
    }

    let matchingProducts = [];
    if (isMongoActive()) {
      try {
        const regex = new RegExp(q, 'i');
        matchingProducts = await ProductModel.find({
          $or: [
            { name: regex },
            { sku: regex },
            { tags: { $in: [regex] } },
            { brand: regex },
            { category: regex }
          ]
        }).limit(6).lean();
      } catch (e) {
        console.error('Mongo search query error, fallback to memory:', e.message);
      }
    }

    if (!matchingProducts || matchingProducts.length === 0) {
      matchingProducts = productsStore.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t && t.toLowerCase().includes(q)))
      ).slice(0, 6);
    }

    const matchingBrands = brands.filter(b => b && b.toLowerCase().includes(q));
    const matchingCategories = categories.filter(c => c && (c.name.toLowerCase().includes(q) || c.slug.includes(q)));

    const suggestions = Array.from(new Set([
      `${q}`,
      `${q} Gaming PC`,
      `${q} Laptop`,
      `${q} Price in Bangladesh`
    ])).slice(0, 4);

    res.json({
      products: matchingProducts,
      brands: matchingBrands,
      categories: matchingCategories,
      suggestions
    });
  } catch (err) {
    console.error('Search API error:', err.message);
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// Compare up to 4 products (Public Access - Star Tech Style High Performance)
app.get('/api/products/compare', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.json({ products: [] });

  if (isMongoActive()) {
    try {
      const dbMatched = await ProductModel.find({ id: { $in: ids } }).lean();
      if (dbMatched && dbMatched.length > 0) {
        return res.json({ products: dbMatched });
      }
    } catch (e) {
      console.error('Mongo compare error:', e.message);
    }
  }

  const matched = productsStore.filter(p => ids.includes(p.id));
  res.json({ products: matched });
});

// Product Creation (Protected: Super Admin OR Approved Co-Admin Only)
app.post('/api/products', requireApprovedAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || body.price === undefined) {
      return res.status(400).json({ message: 'Missing required product fields: name and price are required.' });
    }

    const priceNum = Number(body.price);
    const discountPriceNum = body.discountPrice !== undefined ? Number(body.discountPrice) : priceNum;
    const catName = body.category || 'General';
    const catSlug = body.categorySlug || catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newProd = {
      id: body.id || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: body.name.trim(),
      sku: body.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      brand: body.brand || 'Generic',
      category: catName,
      categorySlug: catSlug,
      builderCategory: body.builderCategory || undefined,
      price: priceNum,
      discountPrice: discountPriceNum,
      stock: body.stock !== undefined ? Number(body.stock) : 10,
      images: Array.isArray(body.images) && body.images.length > 0 
        ? body.images 
        : [body.image || 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop'],
      description: body.description || `${body.name} high quality tech product.`,
      specifications: body.specifications || {},
      warranty: body.warranty || '1 Year',
      rating: body.rating !== undefined ? Number(body.rating) : 5.0,
      reviewsCount: body.reviewsCount !== undefined ? Number(body.reviewsCount) : 0,
      isFlashSale: Boolean(body.isFlashSale),
      flashSalePrice: body.flashSalePrice ? Number(body.flashSalePrice) : undefined,
      tags: Array.isArray(body.tags) ? body.tags : [body.brand || 'TechCore', catName]
    };

    if (isMongoActive()) {
      const created = await ProductModel.create(newProd);
      const createdObj = created.toObject();
      productsStore.unshift(createdObj);
      console.log(`✅ Product created and saved in MongoDB Atlas: ${createdObj.name} (${createdObj.id})`);
      return res.status(201).json(createdObj);
    }

    console.warn(`⚠️ Mongo not connected. Product created in memory RAM store: ${newProd.name}`);
    productsStore.unshift(newProd);
    res.status(201).json(newProd);
  } catch (err) {
    console.error('Product Creation Error:', err);
    res.status(500).json({ message: 'Failed to create product in MongoDB', error: err.message });
  }
});

// Product Update (Protected: Super Admin OR Approved Co-Admin Only)
app.put('/api/products/:id', requireApprovedAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      const updated = await ProductModel.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      ).lean();
      if (updated) return res.json(updated);
    }

    const idx = productsStore.findIndex(p => p.id === req.params.id);
    if (idx !== -1) {
      productsStore[idx] = { ...productsStore[idx], ...req.body };
      return res.json(productsStore[idx]);
    }

    res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    console.error('Product Update Error:', err.message);
    res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
});

// Product Deletion (Protected: Super Admin OR Approved Co-Admin Only)
app.delete('/api/products/:id', requireApprovedAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      await ProductModel.deleteOne({ id: req.params.id });
    }
    productsStore = productsStore.filter(p => p.id !== req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Product Deletion Error:', err.message);
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  if (isMongoConnected) {
    try {
      const dbP = await ProductModel.findOne({ id: req.params.id }).lean();
      if (dbP) return res.json(dbP);
    } catch (e) {}
  }

  const product = productsStore.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

app.get('/api/categories', (req, res) => {
  res.json(categories);
});

app.get('/api/brands', (req, res) => {
  res.json(brands);
});

// -------------------------------------------------------------
// 2. PC BUILDER & INTERACTIVE TOOLS APIS
// -------------------------------------------------------------
app.post('/api/builder/check', (req, res) => {
  try {
    const { selectedComponents } = req.body;
    const evaluation = evaluatePcBuild(selectedComponents || {});
    res.json(evaluation);
  } catch (err) {
    console.error('Builder Check Error:', err.message);
    res.status(500).json({ message: 'PC build evaluation failed', error: err.message });
  }
});

app.post('/api/laptop-finder/recommend', async (req, res) => {
  try {
    const { maxBudget, usageScenario } = req.body;
    let laptops = productsStore.filter(p => p.categorySlug === 'laptop');

    if (isMongoConnected) {
      try {
        const dbLaptops = await ProductModel.find({ categorySlug: 'laptop' }).lean();
        if (dbLaptops && dbLaptops.length > 0) {
          laptops = dbLaptops;
        }
      } catch (e) {
        console.error('Mongo laptop fetch error, fallback to memory:', e.message);
      }
    }

    const scoredLaptops = laptops.map(laptop => {
      let score = 100;
      const price = laptop.discountPrice;

      if (maxBudget && price > maxBudget) {
        score -= Math.min(60, Math.floor((price - maxBudget) / 2000) * 5);
      }

      if (usageScenario) {
        const target = (laptop.specifications?.targetAudience || '').toLowerCase();
        if (target.includes(usageScenario.toLowerCase())) {
          score += 20;
        }
      }

      return {
        laptop,
        matchPercentage: Math.max(40, Math.min(99, score))
      };
    });

    scoredLaptops.sort((a, b) => b.matchPercentage - a.matchPercentage);
    res.json(scoredLaptops);
  } catch (err) {
    console.error('Laptop Finder Error:', err.message);
    res.status(500).json({ message: 'Laptop recommendation failed', error: err.message });
  }
});

// AI PC Recommendation Prompt Simulation Engine
app.post('/api/ai/recommend-pc', async (req, res) => {
  try {
    const { budget, useCase } = req.body;
    const numericBudget = Number(budget) || 80000;

    let allProds = [...productsStore];
    if (isMongoConnected) {
      try {
        const dbProds = await ProductModel.find().lean();
        if (dbProds && dbProds.length > 0) {
          allProds = dbProds;
        }
      } catch (e) {
        console.error('Mongo AI PC fetch error, fallback to memory:', e.message);
      }
    }

    const cpus = allProds.filter(p => p.builderCategory === 'CPU');
    const gpus = allProds.filter(p => p.builderCategory === 'GPU');
    const mbs = allProds.filter(p => p.builderCategory === 'Motherboard');
    const rams = allProds.filter(p => p.builderCategory === 'RAM');
    const psus = allProds.filter(p => p.builderCategory === 'PSU');

    const selectedCpu = cpus.find(c => c.discountPrice <= numericBudget * 0.3) || cpus[0];
    const selectedMb = mbs.find(m => m.specifications?.socket === selectedCpu?.specifications?.socket) || mbs[0];
    const selectedRam = rams.find(r => r.specifications?.ramType === selectedMb?.specifications?.ramType) || rams[0];
    const selectedGpu = gpus.find(g => g.discountPrice <= numericBudget * 0.45) || gpus[0];
    const selectedPsu = psus[0];

    const estimatedTotal = (selectedCpu?.discountPrice || 0) +
                           (selectedMb?.discountPrice || 0) +
                           (selectedRam?.discountPrice || 0) +
                           (selectedGpu?.discountPrice || 0) +
                           (selectedPsu?.discountPrice || 0);

    res.json({
      recommendationSummary: `Optimized custom rig tailored for ${useCase || 'Gaming & Content Creation'} within ৳${numericBudget.toLocaleString()} BDT.`,
      build: {
        cpu: selectedCpu,
        motherboard: selectedMb,
        ram: selectedRam,
        gpu: selectedGpu,
        psu: selectedPsu
      },
      estimatedTotal
    });
  } catch (err) {
    console.error('AI PC Recommendation Error:', err.message);
    res.status(500).json({ message: 'PC recommendation failed', error: err.message });
  }
});

// -------------------------------------------------------------
// 3. CART & ORDER APIS
// -------------------------------------------------------------
app.post('/api/orders', async (req, res) => {
  try {
    const { customer, items, subtotal, discount, deliveryFee, paymentMethod } = req.body;

    const newOrder = {
      id: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      customer,
      items,
      subtotal,
      discount,
      deliveryFee,
      grandTotal: subtotal - discount + deliveryFee,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      paymentStatus: paymentMethod === 'bKash' || paymentMethod === 'Nagad' ? 'Paid' : 'Pending',
      orderStatus: 'Confirmed',
      trackingHistory: [
        { status: 'Pending', time: new Date().toLocaleString() },
        { status: 'Confirmed', time: new Date().toLocaleString() }
      ],
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (isMongoConnected) {
      try {
        await OrderModel.create(newOrder);
      } catch (e) {
        console.error('Mongo Order save error:', e.message);
      }
    }

    // Reduce product inventory stock in memory & MongoDB
    for (const item of (items || [])) {
      const p = productsStore.find(prod => prod.id === item.productId);
      if (p && p.stock >= item.quantity) {
        p.stock -= item.quantity;
      }
      if (isMongoConnected && item.productId && item.quantity > 0) {
        try {
          await ProductModel.findOneAndUpdate(
            { id: item.productId },
            { $inc: { stock: -item.quantity } }
          );
        } catch (e) {
          console.error(`Failed to decrement MongoDB stock for product ${item.productId}:`, e.message);
        }
      }
    }

    ordersStore.unshift(newOrder);

    // Asynchronously generate PDF invoice & dispatch confirmation email + admin notification
    (async () => {
      try {
        const pdfBuffer = await generateInvoicePdfBuffer(newOrder);
        await sendOrderConfirmationEmail({ order: newOrder, pdfBuffer });
        await sendAdminOrderNotificationEmail({ order: newOrder });
      } catch (err) {
        console.error('❌ Asynchronous Order Email/PDF dispatch error:', err.message);
      }
    })();

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Order creation error:', err.message);
    res.status(500).json({ message: 'Order creation failed', error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  if (isMongoConnected) {
    try {
      const dbO = await OrderModel.findOne({ id: req.params.id }).lean();
      if (dbO) return res.json(dbO);
    } catch (e) {}
  }

  const order = ordersStore.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

// -------------------------------------------------------------
// 4. WARRANTY & SERVICE APIS
// -------------------------------------------------------------
app.get('/api/warranty/check', (req, res) => {
  const { serial } = req.query;
  if (!serial) return res.status(400).json({ message: 'Serial number required' });

  res.json({
    serialNumber: serial,
    productName: 'ASUS Dual GeForce RTX 4060 OC 8GB',
    purchaseDate: '2025-10-15',
    expiryDate: '2028-10-15',
    status: 'Active ✓',
    warrantyYears: '3 Years'
  });
});

app.post('/api/warranty/claim', (req, res) => {
  const claim = { id: `WC-${Date.now()}`, ...req.body, status: 'Claim Received', createdAt: new Date().toISOString().split('T')[0] };
  warrantyClaimsStore.push(claim);
  res.status(201).json({ message: 'Warranty claim submitted successfully', claim });
});

app.get('/api/service', (req, res) => {
  res.json(serviceRequestsStore);
});

app.post('/api/service', (req, res) => {
  const newReq = {
    id: `SR-${Math.floor(9000 + Math.random() * 1000)}`,
    ...req.body,
    status: 'Submitted',
    technician: 'Unassigned',
    createdAt: new Date().toISOString().split('T')[0]
  };
  serviceRequestsStore.unshift(newReq);
  res.status(201).json(newReq);
});

// -------------------------------------------------------------
// 5. ADMIN & ERP DASHBOARD APIS
// -------------------------------------------------------------
app.get('/api/admin/analytics', async (req, res) => {
  try {
    let allOrders = [...ordersStore];
    let allProducts = [...productsStore];

    if (isMongoConnected) {
      try {
        const dbOrders = await OrderModel.find().lean();
        if (dbOrders && dbOrders.length > 0) {
          allOrders = dbOrders;
        }
        const dbProducts = await ProductModel.find().lean();
        if (dbProducts && dbProducts.length > 0) {
          allProducts = dbProducts;
        }
      } catch (e) {
        console.error('Mongo analytics fetch error, fallback to memory:', e.message);
      }
    }

    const totalSales = allOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0) + 1450000;
    const totalOrders = allOrders.length + 128;
    const lowStockProducts = allProducts.filter(p => p.stock <= 10);

    res.json({
      kpis: {
        totalSales,
        totalOrders,
        totalCustomers: 492,
        lowStockCount: lowStockProducts.length,
        revenue: totalSales,
        purchaseCost: Math.round(totalSales * 0.75),
        grossProfit: Math.round(totalSales * 0.25)
      },
      salesTrend: [
        { month: 'Jan', sales: 240000, profit: 55000 },
        { month: 'Feb', sales: 310000, profit: 72000 },
        { month: 'Mar', sales: 290000, profit: 68000 },
        { month: 'Apr', sales: 420000, profit: 98000 },
        { month: 'May', sales: 380000, profit: 89000 },
        { month: 'Jun', sales: 510000, profit: 122000 }
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

app.get('/api/admin/inventory', async (req, res) => {
  try {
    let allProducts = [...productsStore];
    if (isMongoConnected) {
      try {
        const dbProducts = await ProductModel.find().lean();
        if (dbProducts && dbProducts.length > 0) {
          allProducts = dbProducts;
        }
      } catch (e) {
        console.error('Mongo inventory fetch error, fallback to memory:', e.message);
      }
    }

    const inventory = allProducts.map(p => ({
      id: p.id,
      sku: p.sku || 'N/A',
      name: p.name,
      brand: p.brand,
      category: p.category,
      currentStock: p.stock,
      soldCount: Math.floor(Math.random() * 40) + 10,
      reservedCount: Math.floor(Math.random() * 5),
      damagedCount: 1,
      status: p.stock <= 8 ? 'LOW_STOCK' : 'IN_STOCK'
    }));

    res.json(inventory);
  } catch (err) {
    console.error('Inventory list error:', err.message);
    res.status(500).json({ message: 'Failed to fetch inventory', error: err.message });
  }
});

app.patch('/api/admin/inventory/:id', async (req, res) => {
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
          return res.json({ message: 'Stock updated successfully in MongoDB', product: updated });
        }
      } catch (e) {
        console.error('Mongo inventory update error:', e.message);
      }
    }

    const prod = productsStore.find(p => p.id === req.params.id);
    if (prod) {
      prod.stock = stockNum;
      return res.json({ message: 'Stock updated', product: prod });
    }
    res.status(404).json({ message: 'Product not found' });
  } catch (err) {
    console.error('Inventory update error:', err.message);
    res.status(500).json({ message: 'Stock update failed', error: err.message });
  }
});

app.get('/api/admin/suppliers', (req, res) => {
  res.json(suppliersStore);
});

app.post('/api/admin/suppliers', (req, res) => {
  const newSupplier = { id: `sup-${suppliersStore.length + 1}`, ...req.body };
  suppliersStore.push(newSupplier);
  res.status(201).json(newSupplier);
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
