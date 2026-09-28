import mongoose from 'mongoose';

const buildSchema = new mongoose.Schema({
  shareId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  title: { type: String, default: 'Custom PC Build' },
  components: { type: mongoose.Schema.Types.Mixed, default: {} },
  totalPrice: { type: Number, default: 0 },
  totalWattage: { type: Number, default: 0 },
  recommendedPsuWattage: { type: Number, default: 500 },
  isCompatible: { type: Boolean, default: true },
  compatibilityDetails: {
    issues: { type: Array, default: [] },
    validChecks: { type: Array, default: [] }
  },
  performanceTier: {
    tier: { type: String, default: 'Entry Level' },
    gamingScore: { type: Number, default: 50 },
    editingScore: { type: Number, default: 50 },
    officeScore: { type: Number, default: 80 }
  }
}, { timestamps: true });

export const BuildModel = mongoose.models.Build || mongoose.model('Build', buildSchema);
