import { RedisTool } from '../../../src/tools/native/RedisTool.js';
import Redis from 'ioredis';

jest.mock('ioredis');

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('RedisTool', () => {
  let redisTool: RedisTool;
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedisInstance = {
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

    MockRedis.mockImplementation(() => mockRedisInstance);
    redisTool = new RedisTool();
  });

  afterEach(async () => {
    await redisTool.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default Redis URL', () => {
      expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379');
    });

    it('should use custom Redis URL from config', () => {
      const customUrl = 'redis://custom-host:6380';
      const tool = new RedisTool({ url: customUrl });
      expect(MockRedis).toHaveBeenCalledWith(customUrl);
    });

    it('should use Redis URL from environment variable', () => {
      const envUrl = 'redis://env-host:6379';
      process.env.REDIS_URL = envUrl;
      const tool = new RedisTool();
      expect(MockRedis).toHaveBeenCalledWith(envUrl);
      delete process.env.REDIS_URL;
    });
  });

  describe('execute', () => {
    it('should execute GET operation successfully', async () => {
      const mockValue = 'test-value';
      mockRedisInstance.get.mockResolvedValue(mockValue);

      const result = await redisTool.execute({
        operation: 'get',
        key: 'test-key'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: mockValue });
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should execute SET operation successfully', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      const result = await redisTool.execute({
        operation: 'set',
        key: 'test-key',
        value: 'test-value'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should execute SET operation with TTL', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      const result = await redisTool.execute({
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        ttl: 60
      });

      expect(result.success).toBe(true);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith('test-key', 60, 'test-value');
    });

    it('should execute DEL operation successfully', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await redisTool.execute({
        operation: 'del',
        key: 'test-key'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ deleted: 1 });
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should execute EXISTS operation successfully', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await redisTool.execute({
        operation: 'exists',
        key: 'test-key'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ exists: true });
      expect(mockRedisInstance.exists).toHaveBeenCalledWith('test-key');
    });

    it('should execute KEYS operation successfully', async () => {
      const mockKeys = ['key1', 'key2', 'key3'];
      mockRedisInstance.keys.mockResolvedValue(mockKeys);

      const result = await redisTool.execute({
        operation: 'keys',
        pattern: 'test-*'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ keys: mockKeys });
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('test-*');
    });

    it('should execute HGET operation successfully', async () => {
      const mockValue = 'hash-value';
      mockRedisInstance.hget.mockResolvedValue(mockValue);

      const result = await redisTool.execute({
        operation: 'hget',
        key: 'test-hash',
        field: 'test-field'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: mockValue });
      expect(mockRedisInstance.hget).toHaveBeenCalledWith('test-hash', 'test-field');
    });

    it('should execute HSET operation successfully', async () => {
      mockRedisInstance.hset.mockResolvedValue(1);

      const result = await redisTool.execute({
        operation: 'hset',
        key: 'test-hash',
        field: 'test-field',
        value: 'hash-value'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockRedisInstance.hset).toHaveBeenCalledWith('test-hash', 'test-field', 'hash-value');
    });

    it('should execute LPUSH operation successfully', async () => {
      mockRedisInstance.lpush.mockResolvedValue(5);

      const result = await redisTool.execute({
        operation: 'lpush',
        key: 'test-list',
        value: 'list-value'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ length: 5 });
      expect(mockRedisInstance.lpush).toHaveBeenCalledWith('test-list', 'list-value');
    });

    it('should execute RPOP operation successfully', async () => {
      const mockValue = 'popped-value';
      mockRedisInstance.rpop.mockResolvedValue(mockValue as any);

      const result = await redisTool.execute({
        operation: 'rpop',
        key: 'test-list'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: mockValue });
      expect(mockRedisInstance.rpop).toHaveBeenCalledWith('test-list');
    });

    it('should handle unknown operation', async () => {
      const result = await redisTool.execute({
        operation: 'unknown',
        key: 'test-key'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown operation: unknown');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await redisTool.execute({
        operation: 'get',
        key: 'test-key'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis connection failed');
    });
  });

  describe('validate', () => {
    it('should validate GET operation parameters', () => {
      expect(redisTool.validate({ operation: 'get', key: 'test' })).toBe(true);
      expect(redisTool.validate({ operation: 'get' })).toBe(false);
    });

    it('should validate SET operation parameters', () => {
      expect(redisTool.validate({ operation: 'set', key: 'test', value: 'value' })).toBe(true);
      expect(redisTool.validate({ operation: 'set', key: 'test' })).toBe(false);
    });

    it('should validate DEL operation parameters', () => {
      expect(redisTool.validate({ operation: 'del', key: 'test' })).toBe(true);
      expect(redisTool.validate({ operation: 'del' })).toBe(false);
    });

    it('should validate HGET operation parameters', () => {
      expect(redisTool.validate({ operation: 'hget', key: 'test', field: 'field' })).toBe(true);
      expect(redisTool.validate({ operation: 'hget', key: 'test' })).toBe(false);
    });

    it('should return false for unknown operation', () => {
      expect(redisTool.validate({ operation: 'unknown', key: 'test' })).toBe(false);
    });
  });

  describe('getSchema', () => {
    it('should return correct schema', () => {
      const schema = redisTool.getSchema();
      
      expect(schema.name).toBe('redis');
      expect(schema.description).toBe('Redis operations tool for data storage and retrieval');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.required).toContain('operation');
      expect(schema.inputSchema.properties.operation.enum).toContain('get');
      expect(schema.inputSchema.properties.operation.enum).toContain('set');
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await redisTool.close();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});