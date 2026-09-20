import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true },
  categorySlug: { type: String, required: true },
  builderCategory: { type: String },
  price: { type: Number, required: true },
  discountPrice: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  images: [{ type: String }],
  description: { type: String },
  specifications: { type: Map, of: mongoose.Schema.Types.Mixed },
  warranty: { type: String, default: '1 Year' },
  rating: { type: Number, default: 5.0 },
  reviewsCount: { type: Number, default: 0 },
  isFlashSale: { type: Boolean, default: false },
  flashSalePrice: { type: Number },
  tags: [{ type: String }]
}, { timestamps: true });

// High-concurrency database indexing for Star-Tech style fast search & filter
productSchema.index({ categorySlug: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ builderCategory: 1 });
productSchema.index({ name: 'text', brand: 'text', category: 'text', tags: 'text' });

export const ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema);
