import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not found in environment. Running with in-memory store.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`🍃 MongoDB Atlas Connected: ${conn.connection.host} / ${conn.connection.name}`);
    return true;
  } catch (err) {
    console.error('❌ MongoDB Atlas connection error:', err.message);
    console.log('🔄 Falling back seamlessly to seeded in-memory store so server stays active.');
    return false;
  }
}
