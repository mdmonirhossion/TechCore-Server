import mongoose from 'mongoose';

const deliveryRuleSchema = new mongoose.Schema({
  insideDhakaFee: { type: Number, default: 60 },
  outsideDhakaFee: { type: Number, default: 120 },
  freeDeliveryThreshold: { type: Number, default: 10000 },
  districtOverrides: [{
    district: { type: String, required: true },
    fee: { type: Number, required: true }
  }]
}, { timestamps: true });

export const DeliveryRuleModel = mongoose.models.DeliveryRule || mongoose.model('DeliveryRule', deliveryRuleSchema);
