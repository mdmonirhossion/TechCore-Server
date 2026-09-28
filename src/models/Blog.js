import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  coverImage: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  content: { type: String, required: true },
  tags: [{ type: String }],
  author: { type: String, default: 'TechCore Editorial' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'PUBLISHED' },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' }
}, { timestamps: true });

blogSchema.index({ status: 1, createdAt: -1 });

export const BlogModel = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
