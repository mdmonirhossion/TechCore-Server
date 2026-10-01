import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  company: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  category: { type: String, default: 'General' },
  address: { type: String },
  status: { type: String, default: 'ACTIVE' }
}, { timestamps: true });

export const SupplierModel = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
