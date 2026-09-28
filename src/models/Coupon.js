import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['PERCENT', 'FIXED'], default: 'FIXED' },
  value: { type: Number, required: true, min: 0 },
  minOrder: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date, required: true },
  applicableCategories: [{ type: String }],
  applicableBrands: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.index({ code: 1, isActive: 1, validTo: 1 });

export const CouponModel = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
