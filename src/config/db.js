import mongoose from 'mongoose';

let dbPromise = null;
let lastMongoError = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastMongoError = 'MONGODB_URI environment variable is missing or empty in Vercel Settings';
    console.warn('⚠️ MONGODB_URI not found in environment. Running with in-memory store.');
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    lastMongoError = null;
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
      lastMongoError = null;
      return true;
    } catch (err) {
      lastMongoError = err.message || 'MongoDB Atlas connection failed';
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

export function getLastMongoError() {
  return lastMongoError;
}
