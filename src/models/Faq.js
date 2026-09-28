import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

faqSchema.index({ order: 1, isActive: 1 });

export const FaqModel = mongoose.models.Faq || mongoose.model('Faq', faqSchema);
