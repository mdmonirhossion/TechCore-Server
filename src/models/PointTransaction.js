import mongoose from 'mongoose';

const pointTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { 
    type: String, 
    enum: ['EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED'], 
    required: true 
  },
  points: { type: Number, required: true },
  amountBdt: { type: Number, default: 0 },
  orderId: { type: String, default: '' },
  description: { type: String, required: true, trim: true }
}, { timestamps: true });

pointTransactionSchema.index({ user: 1, createdAt: -1 });

export const PointTransactionModel = mongoose.models.PointTransaction || mongoose.model('PointTransaction', pointTransactionSchema);
