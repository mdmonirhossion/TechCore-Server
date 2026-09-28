import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, required: true, trim: true },
  userEmail: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
  isVerifiedBuyer: { type: Boolean, default: false },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' }
}, { timestamps: true });

reviewSchema.index({ productId: 1, status: 1 });

export const ReviewModel = mongoose.models.Review || mongoose.model('Review', reviewSchema);
