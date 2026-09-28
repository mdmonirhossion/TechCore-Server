import mongoose from 'mongoose';

const slugRedirectSchema = new mongoose.Schema({
  oldSlug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  newSlug: { type: String, required: true, lowercase: true, trim: true },
  entityType: { type: String, enum: ['PRODUCT', 'CATEGORY', 'BRAND', 'BLOG'], required: true },
  targetUrl: { type: String, required: true }
}, { timestamps: true });

export const SlugRedirectModel = mongoose.models.SlugRedirect || mongoose.model('SlugRedirect', slugRedirectSchema);
