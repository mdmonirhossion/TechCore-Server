import mongoose from 'mongoose';

const campaignProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  campaignPrice: { type: Number, required: true },
  stockLimit: { type: Number, default: 50 }
}, { _id: false });

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  banner: { type: String, default: '' },
  description: { type: String, default: '' },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  type: { 
    type: String, 
    enum: ['FLASH_SALE', 'FESTIVAL', 'CLEARANCE'], 
    default: 'FLASH_SALE' 
  },
  isActive: { type: Boolean, default: true },
  products: [campaignProductSchema]
}, { timestamps: true });

offerSchema.index({ type: 1, isActive: 1, startAt: 1, endAt: 1 });

export const OfferModel = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
