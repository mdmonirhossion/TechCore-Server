import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  subject: { type: String, default: 'General Inquiry', trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['NEW', 'READ', 'REPLIED'], default: 'NEW' }
}, { timestamps: true });

contactMessageSchema.index({ status: 1, createdAt: -1 });

export const ContactMessageModel = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactMessageSchema);
