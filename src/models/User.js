import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['USER', 'CO_ADMIN', 'SUPER_ADMIN'],
    default: 'USER'
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  phone: { type: String, trim: true },
  avatar: { type: String }
}, { timestamps: true });

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
