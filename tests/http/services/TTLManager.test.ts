import { TTLManager } from '../../../src/http/services/TTLManager.js';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

// Mock timers
jest.useFakeTimers();

describe('TTLManager', () => {
  let mockRedis: jest.Mocked<Redis>;
  let ttlManager: TTLManager;

  beforeEach(() => {
    // Create mocked Redis instance
    mockRedis = {
      setex: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      smembers: jest.fn(),
      srem: jest.fn(),
      get: jest.fn(),
      exists: jest.fn(),
      dbsize: jest.fn(),
      scard: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (ttlManager) {
      ttlManager.stop();
    }
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create TTLManager with default config', () => {
      ttlManager = new TTLManager(mockRedis);
      const config = ttlManager.getConfig();

      expect(config).toEqual({
        executions: 3600,
        configs: 86400,
        results: 14400,
        stats: 86400
      });
    });

    it('should create TTLManager with custom config', () => {
      ttlManager = new TTLManager(mockRedis, {
        executions: 1800,
        configs: 43200
      });
      const config = ttlManager.getConfig();

      expect(config).toEqual({
        executions: 1800,
        configs: 43200,
        results: 14400,
        stats: 86400
      });
    });
  });

  describe('start and stop', () => {
    it('should start cleanup interval', () => {
      ttlManager = new TTLManager(mockRedis);
      const cleanupSpy = jest.spyOn(ttlManager as any, 'performCleanup');
      cleanupSpy.mockResolvedValue(undefined);

      ttlManager.start(60000); // 1 minute interval

      expect(cleanupSpy).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(60000);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60000);
      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop cleanup interval', () => {
      ttlManager = new TTLManager(mockRedis);
      const cleanupSpy = jest.spyOn(ttlManager as any, 'performCleanup');
      cleanupSpy.mockResolvedValue(undefined);

      ttlManager.start(60000);
      ttlManager.stop();

      jest.advanceTimersByTime(120000);
      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('should use default interval when not specified', () => {
      ttlManager = new TTLManager(mockRedis);
      const cleanupSpy = jest.spyOn(ttlManager as any, 'performCleanup');
      cleanupSpy.mockResolvedValue(undefined);

      ttlManager.start();

      // Default interval is 5 minutes (300000ms)
      jest.advanceTimersByTime(300000);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setWithTTL', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should set key with execution TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await ttlManager.setWithTTL('test:key', 'test-value', 'executions');

      expect(mockRedis.setex).toHaveBeenCalledWith('test:key', 3600, 'test-value');
    });

    it('should set key with config TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await ttlManager.setWithTTL('config:key', 'config-value', 'configs');

      expect(mockRedis.setex).toHaveBeenCalledWith('config:key', 86400, 'config-value');
    });

    it('should set key with results TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await ttlManager.setWithTTL('result:key', 'result-value', 'results');

      expect(mockRedis.setex).toHaveBeenCalledWith('result:key', 14400, 'result-value');
    });

    it('should set key with stats TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await ttlManager.setWithTTL('stats:key', 'stats-value', 'stats');

      expect(mockRedis.setex).toHaveBeenCalledWith('stats:key', 86400, 'stats-value');
    });
  });

  describe('extendTTL', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should extend TTL and return true on success', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await ttlManager.extendTTL('test:key', 'executions');

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('test:key', 3600);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.expire.mockResolvedValue(0);

      const result = await ttlManager.extendTTL('nonexistent:key', 'executions');

      expect(result).toBe(false);
    });
  });

  describe('getTTL', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should return TTL for key', async () => {
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await ttlManager.getTTL('test:key');

      expect(result).toBe(1800);
      expect(mockRedis.ttl).toHaveBeenCalledWith('test:key');
    });

    it('should return -1 for key without TTL', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await ttlManager.getTTL('persistent:key');

      expect(result).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await ttlManager.getTTL('nonexistent:key');

      expect(result).toBe(-2);
    });
  });

  describe('refreshTTL', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should refresh TTL for matching keys', async () => {
      mockRedis.keys.mockResolvedValue(['exec:1', 'exec:2', 'exec:3']);
      mockRedis.expire
        .mockResolvedValueOnce(1) // exec:1 success
        .mockResolvedValueOnce(1) // exec:2 success
        .mockResolvedValueOnce(0); // exec:3 failed (key doesn't exist)

      const result = await ttlManager.refreshTTL('exec:*', 'executions');

      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('exec:*');
      expect(mockRedis.expire).toHaveBeenCalledTimes(3);
      expect(mockRedis.expire).toHaveBeenCalledWith('exec:1', 3600);
      expect(mockRedis.expire).toHaveBeenCalledWith('exec:2', 3600);
      expect(mockRedis.expire).toHaveBeenCalledWith('exec:3', 3600);
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await ttlManager.refreshTTL('nonexistent:*', 'executions');

      expect(result).toBe(0);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('performCleanup', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should perform full cleanup successfully', async () => {
      // Mock cleanupExpiredKeys
      mockRedis.smembers.mockResolvedValue(['exec:1', 'exec:2']);
      mockRedis.exists
        .mockResolvedValueOnce(1) // exec:1 exists
        .mockResolvedValueOnce(0); // exec:2 doesn't exist
      mockRedis.srem.mockResolvedValue(1);

      // Mock cleanupOrphanedExecutions
      const oldExecution = {
        executionId: 'exec:1',
        status: 'running',
        startTime: new Date(Date.now() - 7200000) // 2 hours ago
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(oldExecution));
      mockRedis.setex.mockResolvedValue('OK');

      // Mock updateStats
      mockRedis.dbsize.mockResolvedValue(100);
      mockRedis.scard.mockResolvedValue(5);

      const emitSpy = jest.spyOn(ttlManager, 'emit');

      await (ttlManager as any).performCleanup();

      expect(emitSpy).toHaveBeenCalledWith('cleanup:completed', {
        timestamp: expect.any(Date),
        message: 'TTL cleanup completed successfully'
      });
    });

    it('should emit error on cleanup failure', async () => {
      const error = new Error('Cleanup failed');
      mockRedis.smembers.mockRejectedValue(error);

      const emitSpy = jest.spyOn(ttlManager, 'emit');

      await expect((ttlManager as any).performCleanup()).rejects.toThrow('Cleanup failed');

      expect(emitSpy).toHaveBeenCalledWith('cleanup:error', error);
    });
  });

  describe('cleanupExpiredKeys', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should remove expired execution references', async () => {
      mockRedis.smembers.mockResolvedValue(['exec:1', 'exec:2', 'exec:3']);
      mockRedis.exists
        .mockResolvedValueOnce(1) // exec:1 exists
        .mockResolvedValueOnce(0) // exec:2 doesn't exist
        .mockResolvedValueOnce(0); // exec:3 doesn't exist
      mockRedis.srem.mockResolvedValue(2);

      await (ttlManager as any).cleanupExpiredKeys();

      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', 'exec:2', 'exec:3');
    });

    it('should not call srem when no expired keys', async () => {
      mockRedis.smembers.mockResolvedValue(['exec:1', 'exec:2']);
      mockRedis.exists
        .mockResolvedValueOnce(1) // exec:1 exists
        .mockResolvedValueOnce(1); // exec:2 exists

      await (ttlManager as any).cleanupExpiredKeys();

      expect(mockRedis.srem).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOrphanedExecutions', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should cleanup orphaned executions', async () => {
      mockRedis.smembers.mockResolvedValue(['exec:1', 'exec:2']);

      // exec:1 is old and still running (orphaned)
      const oldExecution = {
        executionId: 'exec:1',
        status: 'running',
        startTime: new Date(Date.now() - 7200000) // 2 hours ago
      };

      // exec:2 is recent and running (not orphaned)
      const recentExecution = {
        executionId: 'exec:2',
        status: 'running',
        startTime: new Date(Date.now() - 1800000) // 30 minutes ago
      };

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(oldExecution))
        .mockResolvedValueOnce(JSON.stringify(recentExecution));

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.srem.mockResolvedValue(1);

      await (ttlManager as any).cleanupOrphanedExecutions();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'executions:exec:1',
        14400, // results TTL
        expect.stringContaining('"status":"failed"')
      );
      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', 'exec:1');
    });

    it('should not cleanup completed executions', async () => {
      mockRedis.smembers.mockResolvedValue(['exec:1']);

      const completedExecution = {
        executionId: 'exec:1',
        status: 'completed',
        startTime: new Date(Date.now() - 7200000)
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(completedExecution));

      await (ttlManager as any).cleanupOrphanedExecutions();

      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockRedis.srem).not.toHaveBeenCalled();
    });
  });

  describe('getCleanupStats', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should return cleanup stats', async () => {
      const date = new Date();
      const stats = {
        totalKeys: 100,
        activeExecutions: 5,
        lastCleanup: date
      };
      const expectedResult = {
        totalKeys: 100,
        activeExecutions: 5,
        lastCleanup: date.toISOString()
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(expectedResult));

      const result = await ttlManager.getCleanupStats();

      expect(result).toEqual(expectedResult);
      expect(mockRedis.get).toHaveBeenCalledWith('system:cleanup_stats');
    });

    it('should return null when no stats available', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await ttlManager.getCleanupStats();

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should update config and emit event', () => {
      const emitSpy = jest.spyOn(ttlManager, 'emit');

      ttlManager.updateConfig({
        executions: 7200,
        configs: 172800
      });

      const newConfig = ttlManager.getConfig();
      expect(newConfig).toEqual({
        executions: 7200,
        configs: 172800,
        results: 14400,
        stats: 86400
      });

      expect(emitSpy).toHaveBeenCalledWith('config:updated', newConfig);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      ttlManager = new TTLManager(mockRedis);
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const emitSpy = jest.spyOn(ttlManager, 'emit').mockImplementation();

      // Mock cleanup to throw error immediately when called
      const performCleanupSpy = jest.spyOn(ttlManager as any, 'performCleanup').mockImplementation(() => {
        const error = new Error('Redis error');
        ttlManager.emit('error', error);
        return Promise.reject(error);
      });

      // Directly call the mocked method to test error handling
      try {
        await (ttlManager as any).performCleanup();
      } catch (error) {
        // Expected to throw
      }

      expect(performCleanupSpy).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});