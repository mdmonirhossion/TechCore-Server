import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otp: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetModel = mongoose.models.PasswordReset || mongoose.model('PasswordReset', passwordResetSchema);
