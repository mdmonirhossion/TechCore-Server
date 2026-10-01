import { createRequire } from 'module';
const require = createRequire(import.meta.url);

if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  delete process.env.CLOUDINARY_URL;
}

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtqotfpgp',
  api_key: process.env.CLOUDINARY_API_KEY || '878459986752693',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'JYwj877jvGrAvB9wLUvm9ERc9Bo',
  secure: true
});

export default cloudinary;
