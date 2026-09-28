import mongoose from 'mongoose';

const productQaSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, required: true, trim: true },
  question: { type: String, required: true, trim: true },
  answer: { type: String, default: '' },
  answeredBy: { type: String, default: '' },
  answeredAt: { type: Date },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }
}, { timestamps: true });

productQaSchema.index({ productId: 1, status: 1 });

export const ProductQaModel = mongoose.models.ProductQa || mongoose.model('ProductQa', productQaSchema);
