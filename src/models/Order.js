import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  invoiceNo: { type: String, default: function() { return `INV-${Date.now()}`; } },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  customer: {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { 
      type: String, 
      required: true, 
      trim: true,
      match: [/^01[3-9]\d{8}$/, 'Please provide a valid 11-digit Bangladeshi mobile number starting with 01'] 
    },
    address: { type: String, required: true, trim: true },
    division: { type: String, default: 'Dhaka' },
    district: { type: String, default: 'Dhaka' },
    upazila: { type: String, default: 'Dhaka Sadar' },
    city: { type: String, default: 'Dhaka' },
    zone: { type: String, default: 'Inside Dhaka' }
  },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  couponDiscount: { type: Number, default: 0 },
  pointsDiscount: { type: Number, default: 0 },
  deliveryFee: { type: Number, required: true, default: 60 },
  grandTotal: { type: Number, required: true },
  paymentMethod: { 
    type: String, 
    enum: ['Cash on Delivery', 'SSLCommerz', 'bKash', 'Nagad', 'Stripe'], 
    default: 'Cash on Delivery' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'], 
    default: 'Pending' 
  },
  paymentDetails: {
    valId: { type: String },
    tranId: { type: String },
    cardType: { type: String },
    storeAmount: { type: Number },
    bankTranId: { type: String }
  },
  orderStatus: { 
    type: String, 
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'], 
    default: 'CONFIRMED' 
  },
  courier: { type: String, default: 'Pathao Courier' },
  trackingNumber: { type: String, default: '' },
  statusHistory: [{
    status: { type: String, required: true },
    time: { type: String, default: function() { return new Date().toLocaleString(); } },
    note: { type: String, default: '' }
  }]
}, { timestamps: true });

orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

export const OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);
