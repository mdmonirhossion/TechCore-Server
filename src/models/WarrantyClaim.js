import mongoose from 'mongoose';

const warrantyClaimSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  serialNumber: { type: String, required: true },
  productName: { type: String },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  issueDescription: { type: String, required: true },
  status: { type: String, default: 'Claim Received' },
  createdAt: { type: String, default: function() { return new Date().toISOString().split('T')[0]; } }
}, { timestamps: true });

export const WarrantyClaimModel = mongoose.models.WarrantyClaim || mongoose.model('WarrantyClaim', warrantyClaimSchema);
