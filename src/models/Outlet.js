import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, default: 'Dhaka', trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, default: 'support@techcore.com', trim: true },
  openingHours: { type: String, default: '10:00 AM - 8:00 PM (Closed on Tuesday)' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  googleMapsUrl: { type: String, default: '' },
  isHeadOffice: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

outletSchema.index({ city: 1, isActive: 1 });

export const OutletModel = mongoose.models.Outlet || mongoose.model('Outlet', outletSchema);
