import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis;
export function getRedis() { return redis; }

export async function initRedis(): Promise<void> {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  });
  redis.on('error', (err) => logger.warn('Redis: ' + err.message));
  try { await redis.connect(); logger.info('Redis connected'); }
  catch { logger.warn('Redis unavailable — caching disabled'); }
}
