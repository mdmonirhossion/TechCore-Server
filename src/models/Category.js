import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  level: { type: Number, default: 1, min: 1, max: 4 },
  icon: { type: String, default: '' },
  image: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' }
}, { timestamps: true });

categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ level: 1 });

export const CategoryModel = mongoose.models.Category || mongoose.model('Category', categorySchema);
