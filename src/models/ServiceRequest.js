import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  deviceType: { type: String, default: 'Desktop PC' },
  issueDescription: { type: String, required: true },
  technician: { type: String, default: 'Unassigned' },
  status: { type: String, default: 'Submitted' },
  createdAt: { type: String, default: function() { return new Date().toISOString().split('T')[0]; } }
}, { timestamps: true });

export const ServiceRequestModel = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
