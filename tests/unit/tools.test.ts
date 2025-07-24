import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RedisTool } from '../../src/tools/native/RedisTool.js';
import { WebScraperTool } from '../../src/tools/native/WebScraperTool.js';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

const mockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RedisTool', () => {
  let redisTool: RedisTool;
  let mockRedisClient: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      lpush: jest.fn(),
      rpop: jest.fn(),
      quit: jest.fn(),
    } as any;

    mockedRedis.mockImplementation(() => mockRedisClient);
    redisTool = new RedisTool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute GET operation successfully', async () => {
      const mockValue = 'test-value';
      mockRedisClient.get.mockResolvedValue(mockValue);

      const result = await redisTool.execute({
        operation: 'get',
        key: 'test-key'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: mockValue });
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should execute SET operation successfully', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await redisTool.execute({
        operation: 'set',
        key: 'test-key',
        value: 'test-value'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should execute SET with TTL operation successfully', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await redisTool.execute({
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        ttl: 3600
      });

      expect(result.success).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });

    it('should handle Redis errors gracefully', async () => {
      const errorMessage = 'Redis connection error';
      mockRedisClient.get.mockRejectedValue(new Error(errorMessage));

      const result = await redisTool.execute({
        operation: 'get',
        key: 'test-key'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('validate', () => {
    it('should validate required parameters for GET operation', () => {
      expect(redisTool.validate({ operation: 'get', key: 'test-key' })).toBe(true);
      expect(redisTool.validate({ operation: 'get' })).toBe(false);
    });

    it('should validate required parameters for SET operation', () => {
      expect(redisTool.validate({ operation: 'set', key: 'test-key', value: 'value' })).toBe(true);
      expect(redisTool.validate({ operation: 'set', key: 'test-key' })).toBe(false);
    });

    it('should return false for unknown operations', () => {
      expect(redisTool.validate({ operation: 'unknown' })).toBe(false);
    });
  });

  describe('getSchema', () => {
    it('should return valid tool schema', () => {
      const schema = redisTool.getSchema();
      
      expect(schema.name).toBe('redis');
      expect(schema.description).toBe('Redis operations tool for data storage and retrieval');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties.operation.enum).toContain('get');
      expect(schema.inputSchema.properties.operation.enum).toContain('set');
    });
  });
});

describe('WebScraperTool', () => {
  let webScraperTool: WebScraperTool;

  beforeEach(() => {
    webScraperTool = new WebScraperTool();
  });

  describe('validate', () => {
    it('should validate required parameters', () => {
      const validParams = {
        url: 'https://example.com',
        selectors: { title: 'h1' }
      };

      expect(webScraperTool.validate(validParams)).toBe(true);
    });

    it('should reject missing URL', () => {
      const invalidParams = {
        selectors: { title: 'h1' }
      };

      expect(webScraperTool.validate(invalidParams)).toBe(false);
    });

    it('should reject missing selectors', () => {
      const invalidParams = {
        url: 'https://example.com'
      };

      expect(webScraperTool.validate(invalidParams)).toBe(false);
    });
  });

  describe('getSchema', () => {
    it('should return valid tool schema', () => {
      const schema = webScraperTool.getSchema();
      
      expect(schema.name).toBe('web_scraper');
      expect(schema.description).toBe('Web scraping tool for extracting data from websites using Playwright');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.required).toContain('url');
      expect(schema.inputSchema.required).toContain('selectors');
    });
  });
});