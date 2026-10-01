if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  delete process.env.CLOUDINARY_URL;
}

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtqotfpgp',
  api_key: process.env.CLOUDINARY_API_KEY || '878459986752693',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'JYwj877jvGrAvB9wLUvm9ERc9Bo'
});

export default cloudinary;
