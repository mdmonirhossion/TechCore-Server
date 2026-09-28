import mongoose from 'mongoose';

const homeSeoSchema = new mongoose.Schema({
  seoTitle: { type: String, default: 'TechCore | Leading Computer & Tech Retailer in Bangladesh' },
  seoDescription: { type: String, default: 'Shop latest laptops, desktop PCs, graphics cards, processors & tech gadgets at best prices in Bangladesh with official warranty.' },
  seoKeywords: [{ type: String }],
  ogImage: { type: String, default: '' },
  headingTitle: { type: String, default: 'Leading Tech & PC Component Store in Bangladesh' },
  contentBlockHtml: { type: String, default: '<p>TechCore is your trusted destination for genuine computer hardware, custom gaming PCs, laptops, and IT solutions in Bangladesh.</p>' }
}, { timestamps: true });

export const HomeSEOModel = mongoose.models.HomeSEO || mongoose.model('HomeSEO', homeSeoSchema);
