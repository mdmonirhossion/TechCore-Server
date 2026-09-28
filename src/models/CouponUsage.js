import mongoose from 'mongoose';

const couponUsageSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  couponCode: { type: String, required: true, uppercase: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  orderId: { type: String, required: true }
}, { timestamps: true });

couponUsageSchema.index({ couponId: 1, userEmail: 1 });

export const CouponUsageModel = mongoose.models.CouponUsage || mongoose.model('CouponUsage', couponUsageSchema);
