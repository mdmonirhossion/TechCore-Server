import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import cloudinary from './config/cloudinary.js';
import { ProductModel } from './models/Product.js';
import { OrderModel } from './models/Order.js';

import { categories, brands, products as initialProducts, sampleServiceRequests, sampleSuppliers } from './data/seedData.js';
import { evaluatePcBuild } from './services/compatibilityEngine.js';
import { createStripePaymentIntent } from './services/stripeService.js';
import { generateInvoicePdfBuffer } from './services/invoiceService.js';
import { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail } from './services/emailService.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Chrome DevTools background request handling to silence 404/CSP logs
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
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

connectDB().then(async (connected) => {
  isMongoConnected = connected;
  if (connected) {
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
// 1. PRODUCTS & CATALOG APIS
// -------------------------------------------------------------
app.get('/api/products', async (req, res) => {
  const { category, brand, minPrice, maxPrice, search, sort } = req.query;

  let filtered = [...productsStore];

  // If MongoDB is active, fetch from Mongo
  if (isMongoConnected) {
    try {
      const dbProducts = await ProductModel.find().lean();
      if (dbProducts && dbProducts.length > 0) {
        filtered = dbProducts;
      }
    } catch (e) {
      console.error('Mongo fetch error, fallback to memory:', e.message);
    }
  }

  if (category) {
    filtered = filtered.filter(p => p.categorySlug === category || p.category.toLowerCase() === category.toLowerCase());
  }

  if (brand) {
    filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (minPrice) {
    filtered = filtered.filter(p => p.discountPrice >= Number(minPrice));
  }

  if (maxPrice) {
    filtered = filtered.filter(p => p.discountPrice <= Number(maxPrice));
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  if (sort === 'price-low') {
    filtered.sort((a, b) => a.discountPrice - b.discountPrice);
  } else if (sort === 'price-high') {
    filtered.sort((a, b) => b.discountPrice - a.discountPrice);
  } else if (sort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  res.json({
    total: filtered.length,
    products: filtered
  });
});

// Search suggestions & auto-complete multi-field engine
app.get('/api/products/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) {
    return res.json({ products: [], brands: [], categories: [], suggestions: [] });
  }

  const matchingProducts = productsStore.filter(p =>
    p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
  ).slice(0, 6);

  const matchingBrands = brands.filter(b => b.toLowerCase().includes(q));
  const matchingCategories = categories.filter(c => c.name.toLowerCase().includes(q) || c.slug.includes(q));

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
});

// Compare up to 4 products
app.get('/api/products/compare', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  const matched = productsStore.filter(p => ids.includes(p.id));
  res.json({ products: matched });
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
  const { selectedComponents } = req.body;
  const evaluation = evaluatePcBuild(selectedComponents || {});
  res.json(evaluation);
});

app.post('/api/laptop-finder/recommend', (req, res) => {
  const { maxBudget, usageScenario } = req.body;
  const laptops = productsStore.filter(p => p.categorySlug === 'laptop');

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
});

// AI PC Recommendation Prompt Simulation Engine
app.post('/api/ai/recommend-pc', (req, res) => {
  const { budget, useCase } = req.body;
  const numericBudget = Number(budget) || 80000;

  const cpus = productsStore.filter(p => p.builderCategory === 'CPU');
  const gpus = productsStore.filter(p => p.builderCategory === 'GPU');
  const mbs = productsStore.filter(p => p.builderCategory === 'Motherboard');
  const rams = productsStore.filter(p => p.builderCategory === 'RAM');
  const psus = productsStore.filter(p => p.builderCategory === 'PSU');

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
});

// -------------------------------------------------------------
// 3. CART & ORDER APIS
// -------------------------------------------------------------
app.post('/api/orders', async (req, res) => {
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

  // Reduce product inventory stock
  items.forEach(item => {
    const p = productsStore.find(prod => prod.id === item.productId);
    if (p && p.stock >= item.quantity) {
      p.stock -= item.quantity;
    }
  });

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
app.get('/api/admin/analytics', (req, res) => {
  const totalSales = ordersStore.reduce((sum, o) => sum + o.grandTotal, 0) + 1450000;
  const totalOrders = ordersStore.length + 128;
  const lowStockProducts = productsStore.filter(p => p.stock <= 10);

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
});

app.get('/api/admin/inventory', (req, res) => {
  const inventory = productsStore.map(p => ({
    id: p.id,
    sku: p.sku,
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
});

app.patch('/api/admin/inventory/:id', (req, res) => {
  const { newStock } = req.body;
  const prod = productsStore.find(p => p.id === req.params.id);
  if (prod) {
    prod.stock = Number(newStock);
    return res.json({ message: 'Stock updated', product: prod });
  }
  res.status(404).json({ message: 'Product not found' });
});

app.get('/api/admin/suppliers', (req, res) => {
  res.json(suppliersStore);
});

app.post('/api/admin/suppliers', (req, res) => {
  const newSupplier = { id: `sup-${suppliersStore.length + 1}`, ...req.body };
  suppliersStore.push(newSupplier);
  res.status(201).json(newSupplier);
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
