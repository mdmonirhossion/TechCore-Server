import mongoose from 'mongoose';

const warrantySchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true, index: true },
  productName: { type: String, required: true },
  customerName: { type: String },
  customerPhone: { type: String },
  purchaseDate: { type: String, default: '2025-10-15' },
  expiryDate: { type: String, default: '2028-10-15' },
  status: { type: String, default: 'Active' },
  warrantyYears: { type: String, default: '3 Years' },
  serviceCenter: { type: String, default: 'Multiplan Center Branch (Level 4, Shop #408)' }
}, { timestamps: true });

export const WarrantyModel = mongoose.models.Warranty || mongoose.model('Warranty', warrantySchema);
