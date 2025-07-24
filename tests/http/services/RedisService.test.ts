import { RedisService } from '../../../src/http/services/RedisService.js';
import { PubSubManager } from '../../../src/websocket/PubSubManager.js';
import Redis from 'ioredis';
import { ExecutionMetadata, ExecutionStatus } from '../../../src/http/types.js';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

// Mock PubSubManager
jest.mock('../../../src/websocket/PubSubManager.js');
const MockedPubSubManager = PubSubManager as jest.MockedClass<typeof PubSubManager>;

describe('RedisService', () => {
  let mockRedis: jest.Mocked<Redis>;
  let mockPubSubManager: jest.Mocked<PubSubManager>;
  let redisService: RedisService;

  beforeEach(() => {
    // Create mocked Redis instance
    mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      scard: jest.fn(),
      dbsize: jest.fn(),
      info: jest.fn(),
      time: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn()
    } as any;

    // Create mocked PubSubManager instance
    mockPubSubManager = {
      publishExecutionUpdate: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    MockedPubSubManager.mockImplementation(() => mockPubSubManager);

    redisService = new RedisService(mockRedis, mockPubSubManager);

    jest.clearAllMocks();
  });

  describe('createExecution', () => {
    it('should create a new agent execution', async () => {
      const metadata: ExecutionMetadata = {
        configPath: 'examples/agents/basic-agent.yaml',
        task: 'Research AI trends'
      };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const executionId = await redisService.createExecution('agent', metadata, 3600);

      expect(executionId).toMatch(/^agent_[a-f0-9-]+$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        3600,
        expect.stringContaining('"status":"queued"')
      );
      expect(mockRedis.sadd).toHaveBeenCalledWith('active_executions', executionId);
      expect(mockRedis.expire).toHaveBeenCalledWith('active_executions', 3600);
    });

    it('should create a new crew execution', async () => {
      const metadata: ExecutionMetadata = {
        configPath: 'examples/crews/research-crew.yaml',
        input: 'Analyze market trends'
      };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const executionId = await redisService.createExecution('crew', metadata, 7200);

      expect(executionId).toMatch(/^crew_[a-f0-9-]+$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        7200,
        expect.stringContaining('"status":"queued"')
      );
    });

    it('should use default TTL when not provided', async () => {
      const metadata: ExecutionMetadata = {
        configPath: 'examples/agents/basic-agent.yaml',
        task: 'Test task'
      };

      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await redisService.createExecution('agent', metadata);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^executions:agent_/),
        3600, // Default TTL
        expect.any(String)
      );
    });
  });

  describe('updateExecutionStatus', () => {
    const executionId = 'agent_test123';

    beforeEach(() => {
      const existingExecution: ExecutionStatus = {
        executionId,
        status: 'running',
        startTime: new Date('2025-01-24T10:00:00Z'),
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Test task'
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingExecution));
      mockRedis.ttl.mockResolvedValue(1800);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.srem.mockResolvedValue(1);
    });

    it('should update execution status', async () => {
      await redisService.updateExecutionStatus(
        executionId,
        'running',
        0.5,
        'processing'
      );

      expect(mockRedis.get).toHaveBeenCalledWith(`executions:${executionId}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        1800,
        expect.stringContaining('"progress":0.5')
      );
      expect(mockPubSubManager.publishExecutionUpdate).toHaveBeenCalledWith(
        executionId,
        'running',
        0.5,
        {
          currentStep: 'processing',
          result: undefined,
          error: undefined,
          metadata: expect.any(Object)
        }
      );
    });

    it('should complete execution and remove from active set', async () => {
      await redisService.updateExecutionStatus(
        executionId,
        'completed',
        1.0,
        'finished',
        'Final result'
      );

      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', executionId);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        1800,
        expect.stringContaining('"status":"completed"')
      );
    });

    it('should fail execution and remove from active set', async () => {
      await redisService.updateExecutionStatus(
        executionId,
        'failed',
        undefined,
        'error',
        undefined,
        'Execution failed'
      );

      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', executionId);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        1800,
        expect.stringContaining('"error":"Execution failed"')
      );
    });

    it('should throw error when execution not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        redisService.updateExecutionStatus(executionId, 'running')
      ).rejects.toThrow(`Execution ${executionId} not found`);
    });

    it('should use default TTL when current TTL is invalid', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      await redisService.updateExecutionStatus(executionId, 'running');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `executions:${executionId}`,
        3600, // Default TTL
        expect.any(String)
      );
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status when found', async () => {
      const execution: ExecutionStatus = {
        executionId: 'agent_test123',
        status: 'running',
        progress: 0.5,
        startTime: new Date('2025-01-24T10:00:00Z'),
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Test task'
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(execution));

      const result = await redisService.getExecutionStatus('agent_test123');

      expect(result).toEqual(execution);
      expect(mockRedis.get).toHaveBeenCalledWith('executions:agent_test123');
    });

    it('should return null when execution not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisService.getExecutionStatus('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getExecutionResult', () => {
    it('should return result for completed execution', async () => {
      const execution: ExecutionStatus = {
        executionId: 'agent_test123',
        status: 'completed',
        result: 'Final result',
        startTime: new Date('2025-01-24T10:00:00Z'),
        endTime: new Date('2025-01-24T10:01:00Z'),
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Test task',
          tokensUsed: 1500
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(execution));

      const result = await redisService.getExecutionResult('agent_test123');

      expect(result).toEqual({
        executionId: 'agent_test123',
        result: 'Final result',
        metadata: execution.metadata,
        tokensUsed: 1500,
        executionTime: 60000, // 1 minute
        completedAt: execution.endTime
      });
    });

    it('should return null for non-completed execution', async () => {
      const execution: ExecutionStatus = {
        executionId: 'agent_test123',
        status: 'running',
        startTime: new Date(),
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Test task'
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(execution));

      const result = await redisService.getExecutionResult('agent_test123');

      expect(result).toBeNull();
    });

    it('should return null when execution not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisService.getExecutionResult('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveExecutions', () => {
    it('should return list of active executions', async () => {
      const activeExecutions = ['agent_123', 'crew_456', 'agent_789'];
      mockRedis.smembers.mockResolvedValue(activeExecutions);

      const result = await redisService.getActiveExecutions();

      expect(result).toEqual(activeExecutions);
      expect(mockRedis.smembers).toHaveBeenCalledWith('active_executions');
    });

    it('should return empty array when no active executions', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await redisService.getActiveExecutions();

      expect(result).toEqual([]);
    });
  });

  describe('cacheConfig', () => {
    it('should cache configuration with specified TTL', async () => {
      const config = { id: 'test-agent', name: 'Test Agent' };
      mockRedis.setex.mockResolvedValue('OK');

      await redisService.cacheConfig('examples/agents/test.yaml', config, 7200);

      const expectedKey = `configs:${Buffer.from('examples/agents/test.yaml').toString('base64')}`;
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expectedKey,
        7200,
        JSON.stringify(config)
      );
    });

    it('should cache configuration with default TTL', async () => {
      const config = { id: 'test-agent', name: 'Test Agent' };
      mockRedis.setex.mockResolvedValue('OK');

      await redisService.cacheConfig('examples/agents/test.yaml', config);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        86400, // Default 24h TTL
        JSON.stringify(config)
      );
    });
  });

  describe('getCachedConfig', () => {
    it('should return cached configuration', async () => {
      const config = { id: 'test-agent', name: 'Test Agent' };
      mockRedis.get.mockResolvedValue(JSON.stringify(config));

      const result = await redisService.getCachedConfig('examples/agents/test.yaml');

      expect(result).toEqual(config);
      const expectedKey = `configs:${Buffer.from('examples/agents/test.yaml').toString('base64')}`;
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should return null when configuration not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisService.getCachedConfig('nonexistent.yaml');

      expect(result).toBeNull();
    });
  });

  describe('getSystemStats', () => {
    it('should return system statistics', async () => {
      mockRedis.scard.mockResolvedValue(5);
      mockRedis.dbsize.mockResolvedValue(100);
      mockRedis.info.mockResolvedValue('used_memory_human:45MB\r\nconnected_clients:3\r\n');
      mockRedis.time.mockResolvedValue([1642176000, 123456]);
      mockRedis.get.mockResolvedValue('42'); // completed today count

      const stats = await redisService.getSystemStats();

      expect(stats).toEqual({
        activeExecutions: 5,
        completedToday: 42,
        totalExecutions: 100,
        redisMemory: '45MB',
        uptime: 1642176000123456,
        connections: 3
      });
    });

    it('should handle missing memory info', async () => {
      mockRedis.scard.mockResolvedValue(0);
      mockRedis.dbsize.mockResolvedValue(0);
      mockRedis.info.mockResolvedValue('some_other_info:value\r\n');
      mockRedis.time.mockResolvedValue([1642176000, 123456]);
      mockRedis.get.mockResolvedValue(null);

      const stats = await redisService.getSystemStats();

      expect(stats.redisMemory).toBe('0B');
      expect(stats.completedToday).toBe(0);
    });
  });

  describe('incrementCompletedCount', () => {
    it('should increment completed count for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockRedis.incr.mockResolvedValue(43);
      mockRedis.expire.mockResolvedValue(1);

      await redisService.incrementCompletedCount();

      expect(mockRedis.incr).toHaveBeenCalledWith(`stats:completed:${today}`);
      expect(mockRedis.expire).toHaveBeenCalledWith(`stats:completed:${today}`, 172800); // 2 days
    });
  });

  describe('cleanup', () => {
    it('should clean up stale active executions', async () => {
      const activeExecutions = ['agent_123', 'agent_456', 'crew_789'];
      mockRedis.smembers.mockResolvedValue(activeExecutions);

      // Mock executions with different ages
      const oldExecution = {
        executionId: 'agent_123',
        status: 'running',
        startTime: new Date(Date.now() - 7200000) // 2 hours ago
      };
      const recentExecution = {
        executionId: 'agent_456',
        status: 'running',
        startTime: new Date(Date.now() - 1800000) // 30 minutes ago
      };

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(oldExecution))
        .mockResolvedValueOnce(JSON.stringify(recentExecution))
        .mockResolvedValueOnce(null); // crew_789 not found

      mockRedis.srem.mockResolvedValue(1);

      await redisService.cleanup();

      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', 'agent_123');
      expect(mockRedis.srem).toHaveBeenCalledWith('active_executions', 'crew_789');
      expect(mockRedis.srem).toHaveBeenCalledTimes(2);
    });
  });
});