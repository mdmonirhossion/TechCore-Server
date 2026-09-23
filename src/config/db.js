import mongoose from 'mongoose';

let dbPromise = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not found in environment. Running with in-memory store.');
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000
      });
      console.log(`🍃 MongoDB Atlas Connected: ${conn.connection.host} / ${conn.connection.name}`);
      return true;
    } catch (err) {
      console.error('❌ MongoDB Atlas connection error:', err.message);
      console.log('🔄 Falling back seamlessly to seeded in-memory store so server stays active.');
      dbPromise = null;
      return false;
    }
  })();

  return dbPromise;
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
