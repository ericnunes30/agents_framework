import Redis from 'ioredis';

export interface RedisConfig {
  url: string;
  retryStrategy?: (times: number) => number | void | null;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

const defaultRetryStrategy = (times: number): number => {
  const delay = Math.min(times * 50, 2000);
  return delay;
};

export const createRedisConnection = (config: Partial<RedisConfig> = {}): Redis => {
  const redisConfig: RedisConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retryStrategy: defaultRetryStrategy,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    ...config
  };

  const redis = new Redis(redisConfig.url, {
    retryStrategy: redisConfig.retryStrategy,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    lazyConnect: redisConfig.lazyConnect
  });

  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('close', () => {
    console.log('Redis connection closed');
  });

  return redis;
};

export const createRedisConnections = (): {
  main: Redis;
  subscriber: Redis;
  publisher: Redis;
} => {
  return {
    main: createRedisConnection(),
    subscriber: createRedisConnection(),
    publisher: createRedisConnection()
  };
};