import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  productIds: [{ type: String, required: true }]
}, { timestamps: true });

export const WishlistModel = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
