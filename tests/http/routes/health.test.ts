import request from 'supertest';
import express from 'express';
import { createHealthRouter } from '../../../src/http/routes/health.js';
import { StateManager } from '../../../src/state/StateManager.js';
import { RedisService } from '../../../src/http/services/RedisService.js';

// Mock dependencies
jest.mock('../../../src/state/StateManager.js');
jest.mock('../../../src/http/services/RedisService.js');

const MockedStateManager = StateManager as jest.MockedClass<typeof StateManager>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('Health Routes', () => {
  let app: express.Application;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Create mock instances
    mockStateManager = {
      healthCheck: jest.fn()
    } as any;

    mockRedisService = {
      getRedisInfo: jest.fn()
    } as any;

    MockedStateManager.mockImplementation(() => mockStateManager);
    MockedRedisService.mockImplementation(() => mockRedisService);

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/health', createHealthRouter(mockStateManager, mockRedisService));

    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when all systems are ok', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        redis: {
          status: 'connected' as const,
          latency: 5
        },
        memory: {
          usage: 45000000,
          limit: 100000000
        },
        timestamp: new Date()
      };

      const mockRedisInfo = {
        connected: true,
        keys: 145,
        memory: '45MB',
        connections: 3,
        version: '7.0.11'
      };

      mockStateManager.healthCheck.mockResolvedValue(mockHealthCheck);
      mockRedisService.getRedisInfo.mockResolvedValue(mockRedisInfo);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(response.body.redis).toEqual(mockRedisInfo);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.redis.status).toBe('connected');
      expect(response.body.health.memory.usage).toBe(45000000);

      expect(mockStateManager.healthCheck).toHaveBeenCalled();
      expect(mockRedisService.getRedisInfo).toHaveBeenCalled();
    });

    it('should return unhealthy status when health check fails', async () => {
      const error = new Error('Redis connection failed');
      mockStateManager.healthCheck.mockRejectedValue(error);

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toEqual({
        status: 'unhealthy',
        error: 'Redis connection failed',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    it('should return unhealthy status when redis info fails', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        redis: {
          status: 'connected' as const,
          latency: 5
        },
        memory: {
          usage: 45000000,
          limit: 100000000
        },
        timestamp: new Date()
      };
      mockStateManager.healthCheck.mockResolvedValue(mockHealthCheck);
      mockRedisService.getRedisInfo.mockRejectedValue(new Error('Redis info failed'));

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toEqual({
        status: 'unhealthy',
        error: 'Redis info failed',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockStateManager.healthCheck.mockRejectedValue('String error');

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toEqual({
        status: 'unhealthy',
        error: 'String error',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    it('should handle empty health check results', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        redis: {
          status: 'connected' as const,
          latency: 5
        },
        memory: {
          usage: 45000000,
          limit: 100000000
        },
        timestamp: new Date()
      };
      mockStateManager.healthCheck.mockResolvedValue(mockHealthCheck);
      mockRedisService.getRedisInfo.mockResolvedValue({
        connected: false,
        keys: 0,
        memory: '0B',
        connections: 0,
        version: 'unknown'
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.redis.connected).toBe(false);
      expect(response.body.health.status).toBe('healthy');
    });

    it('should include correct timestamp format', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        redis: {
          status: 'connected' as const,
          latency: 5
        },
        memory: {
          usage: 45000000,
          limit: 100000000
        },
        timestamp: new Date()
      };
      mockStateManager.healthCheck.mockResolvedValue(mockHealthCheck);
      mockRedisService.getRedisInfo.mockResolvedValue({
        connected: true,
        keys: 0,
        memory: '0B',
        connections: 0,
        version: '7.0.0'
      });

      const beforeRequest = new Date();
      const response = await request(app).get('/health');
      const afterRequest = new Date();

      const responseTime = new Date(response.body.timestamp);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should handle concurrent health check requests', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        redis: {
          status: 'connected' as const,
          latency: 5
        },
        memory: {
          usage: 45000000,
          limit: 100000000
        },
        timestamp: new Date()
      };
      mockStateManager.healthCheck.mockResolvedValue(mockHealthCheck);
      mockRedisService.getRedisInfo.mockResolvedValue({
        connected: true,
        keys: 100,
        memory: '50MB',
        connections: 5,
        version: '7.0.11'
      });

      const requests = Array(5).fill(null).map(() => 
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });

      // Ensure health check was called for each request
      expect(mockStateManager.healthCheck).toHaveBeenCalledTimes(5);
      expect(mockRedisService.getRedisInfo).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures gracefully', async () => {
      // State manager succeeds but returns partial info
      mockStateManager.healthCheck.mockResolvedValue({
        status: 'degraded' as const,
        redis: {
          status: 'connected' as const,
          latency: 15
        },
        memory: {
          usage: 80000000,
          limit: 100000000
        },
        timestamp: new Date()
      });

      // Redis info succeeds
      mockRedisService.getRedisInfo.mockResolvedValue({
        connected: true,
        keys: 50,
        memory: '25MB',
        connections: 2,
        version: '7.0.11'
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.health.status).toBe('degraded');
      expect(response.body.redis.connected).toBe(true);
    });
  });
});