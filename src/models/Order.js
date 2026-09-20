import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    zone: { type: String, required: true }
  },
  items: [{
    productId: { type: String },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number }
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  deliveryFee: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Cash on Delivery' },
  paymentStatus: { type: String, default: 'Pending' },
  orderStatus: { type: String, default: 'Confirmed' },
  trackingHistory: [{
    status: { type: String },
    time: { type: String }
  }]
}, { timestamps: true });

export const OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);
