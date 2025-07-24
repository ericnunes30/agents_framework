import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimitConfig } from '../types.js';

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(this.config.windowMs / 1000));
      }

      const remaining = Math.max(0, this.config.max - current);
      
      res.set({
        'X-RateLimit-Limit': this.config.max.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + this.config.windowMs).toISOString()
      });

      if (current > this.config.max) {
        return res.status(429).json({
          error: this.config.message || 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(this.config.windowMs / 1000)
        });
      }

      next();
    };
  }

  private getKey(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.headers['x-user-id'] || 'anonymous';
    return `rate_limit:${ip}:${userId}`;
  }
}

export const createRateLimiter = (redis: Redis, config: Partial<RateLimitConfig> = {}) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  };

  return new RateLimiter(redis, { ...defaultConfig, ...config });
};