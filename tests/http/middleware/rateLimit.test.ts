import { RateLimiter, createRateLimiter } from '../../../src/http/middleware/rateLimit.js';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RateLimiter', () => {
  let mockRedis: jest.Mocked<Redis>;
  let rateLimiter: RateLimiter;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mocked Redis instance
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    // Create rate limiter
    rateLimiter = new RateLimiter(mockRedis, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    });

    // Create mock request/response
    mockReq = {
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' } as any,
      headers: {}
    } as any;

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('middleware', () => {
    it('should allow request when under rate limit', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.incr).toHaveBeenCalledWith('rate_limit:192.168.1.1:anonymous');
      expect(mockRedis.expire).toHaveBeenCalledWith('rate_limit:192.168.1.1:anonymous', 900);
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': expect.any(String)
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block request when over rate limit', async () => {
      mockRedis.incr.mockResolvedValue(101);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 900
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom user ID from headers', async () => {
      mockReq.headers = { 'x-user-id': 'user123' };
      mockRedis.incr.mockResolvedValue(1);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.incr).toHaveBeenCalledWith('rate_limit:192.168.1.1:user123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing IP address', async () => {
      (mockReq as any).ip = undefined;
      (mockReq as any).connection = {} as any;
      mockRedis.incr.mockResolvedValue(1);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.incr).toHaveBeenCalledWith('rate_limit:unknown:anonymous');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set correct remaining count', async () => {
      mockRedis.incr.mockResolvedValue(50);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '50',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should not set expire on subsequent requests', async () => {
      mockRedis.incr.mockResolvedValue(5); // Not first request

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter with default config', () => {
      const limiter = createRateLimiter(mockRedis);
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create rate limiter with custom config', () => {
      const limiter = createRateLimiter(mockRedis, {
        windowMs: 60000,
        max: 50,
        message: 'Custom message'
      });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should merge custom config with defaults', async () => {
      const limiter = createRateLimiter(mockRedis, {
        max: 50
      });

      mockRedis.incr.mockResolvedValue(51);

      const middleware = limiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 900
      });
    });
  });
});