import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  linkUrl: { type: String, default: '#' },
  position: { 
    type: String, 
    enum: ['HERO_SLIDER', 'OFFER_GRID', 'TOP_BAR', 'FOOTER'], 
    default: 'HERO_SLIDER' 
  },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bannerSchema.index({ position: 1, order: 1, isActive: 1 });

export const BannerModel = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
