import Redis from 'ioredis';

// In-Memory Fallback Cache Store
class MemoryCache {
  constructor() {
    this.store = new Map();
    // Periodic garbage collection for expired entries (unref to avoid hanging node process)
    const timer = setInterval(() => this.cleanup(), 60000);
    if (timer.unref) timer.unref();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 300) {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  del(key) {
    this.store.delete(key);
  }

  clearByPrefix(prefix) {
    const pfx = `${prefix}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(pfx) || key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiry) {
        this.store.delete(key);
      }
    }
  }
}

const memoryCache = new MemoryCache();

let redisClient = null;
let isRedisConnected = false;

const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 4000,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 1000, 3000);
      }
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ Connected to Redis cache service.');
    });

    redisClient.on('ready', () => {
      isRedisConnected = true;
    });

    redisClient.on('error', (err) => {
      if (isRedisConnected) {
        console.warn('⚠️ Redis error, switching to In-Memory cache:', err.message);
      }
      isRedisConnected = false;
    });

    redisClient.on('close', () => {
      isRedisConnected = false;
    });

    redisClient.connect().catch((err) => {
      console.log(`ℹ️ Redis connection bypassed (${err.message}). Using In-Memory RAM Cache fallback.`);
    });
  } catch (err) {
    console.warn('⚠️ Failed to initialize Redis client, falling back to memory cache:', err.message);
  }
} else {
  console.log('ℹ️ REDIS_URL not configured. Running with high-performance In-Memory Cache.');
}

/**
 * Get item from cache (Redis if available, else In-Memory)
 */
export async function getCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      // Fallback on error
    }
  }
  return memoryCache.get(key);
}

/**
 * Set item in cache
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds default 300s (5 minutes)
 */
export async function setCache(key, value, ttlSeconds = 300) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Fallback
    }
  }
  memoryCache.set(key, value, ttlSeconds);
}

/**
 * Delete a specific key from cache
 */
export async function deleteCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch {}
  }
  memoryCache.del(key);
}

/**
 * Invalidate all cache entries matching a prefix (e.g. 'products', 'categories')
 */
export async function clearCacheByPrefix(prefix) {
  memoryCache.clearByPrefix(prefix);

  if (isRedisConnected && redisClient) {
    try {
      const stream = redisClient.scanStream({
        match: `${prefix}:*`,
        count: 100
      });

      stream.on('data', async (keys) => {
        if (keys && keys.length > 0) {
          const pipeline = redisClient.pipeline();
          keys.forEach((k) => pipeline.del(k));
          await pipeline.exec();
        }
      });
    } catch (e) {
      console.warn('Failed to clear redis prefix:', e.message);
    }
  }
}

/**
 * Helper to invalidate all product caches
 */
export async function invalidateProductCache() {
  await clearCacheByPrefix('products');
}

/**
 * Helper to invalidate all category caches
 */
export async function invalidateCategoryCache() {
  await clearCacheByPrefix('categories');
}

/**
 * Express middleware to cache GET requests
 * @param {string} prefix cache namespace (e.g. 'products', 'categories')
 * @param {number} ttlSeconds TTL in seconds (default 300)
 */
export const cacheMiddleware = (prefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${prefix}:${req.originalUrl || req.url}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached !== null && cached !== undefined) {
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Cache-Provider', isRedisConnected ? 'Redis' : 'Memory');
        return res.json(cached);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Cache-Provider', isRedisConnected ? 'Redis' : 'Memory');

      // Hook res.json to automatically cache the payload on successful responses
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(cacheKey, body, ttlSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // If cache fails, never fail the client request
      console.error('Cache middleware error:', err);
      next();
    }
  };
};

export function getCacheStatus() {
  return {
    provider: isRedisConnected ? 'Redis' : 'In-Memory (RAM)',
    isRedisConnected,
    hasRedisEnv: Boolean(redisUrl)
  };
}

export default {
  getCache,
  setCache,
  deleteCache,
  clearCacheByPrefix,
  invalidateProductCache,
  invalidateCategoryCache,
  cacheMiddleware,
  getCacheStatus
};
