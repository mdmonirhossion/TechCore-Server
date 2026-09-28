import mongoose from 'mongoose';

const staticPageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  contentHtml: { type: String, required: true },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  seoKeywords: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const StaticPageModel = mongoose.models.StaticPage || mongoose.model('StaticPage', staticPageSchema);
