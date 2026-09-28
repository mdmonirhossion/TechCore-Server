import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  logo: { type: String, default: '' },
  banner: { type: String, default: '' },
  description: { type: String, default: '' },
  isFeatured: { type: Boolean, default: false },
  isExclusiveDistributor: { type: Boolean, default: false },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' }
}, { timestamps: true });

brandSchema.index({ name: 1 });

export const BrandModel = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
