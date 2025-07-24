import request from 'supertest';
import express from 'express';
import { createSystemRouter } from '../../../src/http/routes/system.js';
import { StateManager } from '../../../src/state/StateManager.js';
import { RedisService } from '../../../src/http/services/RedisService.js';
import { TTLManager } from '../../../src/http/services/TTLManager.js';
import { CrewRunner } from '../../../src/crews/CrewRunner.js';

// Mock dependencies
jest.mock('../../../src/state/StateManager.js');
jest.mock('../../../src/http/services/RedisService.js');
jest.mock('../../../src/http/services/TTLManager.js');
jest.mock('../../../src/crews/CrewRunner.js');

const MockedStateManager = StateManager as jest.MockedClass<typeof StateManager>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;
const MockedTTLManager = TTLManager as jest.MockedClass<typeof TTLManager>;
const MockedCrewRunner = CrewRunner as jest.MockedClass<typeof CrewRunner>;

describe('System Routes', () => {
  let app: express.Application;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockTTLManager: jest.Mocked<TTLManager>;
  let mockCrewRunner: jest.Mocked<CrewRunner>;

  beforeEach(() => {
    // Create mock instances
    mockStateManager = {} as any;

    mockRedisService = {
      getSystemStats: jest.fn(),
      getRedisInfo: jest.fn(),
      getActiveExecutions: jest.fn()
    } as any;

    mockTTLManager = {
      getCleanupStats: jest.fn(),
      getConfig: jest.fn()
    } as any;

    mockCrewRunner = {
      getSystemOverview: jest.fn()
    } as any;

    MockedStateManager.mockImplementation(() => mockStateManager);
    MockedRedisService.mockImplementation(() => mockRedisService);
    MockedTTLManager.mockImplementation(() => mockTTLManager);
    MockedCrewRunner.mockImplementation(() => mockCrewRunner);

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/system', createSystemRouter(
      mockStateManager,
      mockRedisService,
      mockTTLManager,
      mockCrewRunner
    ));

    jest.clearAllMocks();
  });

  describe('GET /api/system/stats', () => {
    it('should return system statistics', async () => {
      const mockStats = {
        activeExecutions: 5,
        completedToday: 120,
        totalExecutions: 1547,
        redisMemory: '45MB',
        uptime: 3600000,
        connections: 8
      };

      mockRedisService.getSystemStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/system/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
      expect(mockRedisService.getSystemStats).toHaveBeenCalled();
    });

    it('should handle stats retrieval errors', async () => {
      mockRedisService.getSystemStats.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/system/stats')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Redis connection failed'
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockRedisService.getSystemStats.mockRejectedValue('String error');

      const response = await request(app)
        .get('/api/system/stats')
        .expect(500);

      expect(response.body).toEqual({
        error: 'String error'
      });
    });
  });

  describe('GET /api/system/redis', () => {
    it('should return Redis information', async () => {
      const mockRedisInfo = {
        connected: true,
        keys: 145,
        memory: '45MB',
        connections: 3,
        version: '7.0.11'
      };

      mockRedisService.getRedisInfo.mockResolvedValue(mockRedisInfo);

      const response = await request(app)
        .get('/api/system/redis')
        .expect(200);

      expect(response.body).toEqual(mockRedisInfo);
      expect(mockRedisService.getRedisInfo).toHaveBeenCalled();
    });

    it('should handle Redis info errors', async () => {
      mockRedisService.getRedisInfo.mockRejectedValue(new Error('Redis info failed'));

      const response = await request(app)
        .get('/api/system/redis')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Redis info failed'
      });
    });

    it('should return disconnected state when Redis is down', async () => {
      const mockRedisInfo = {
        connected: false,
        keys: 0,
        memory: '0B',
        connections: 0,
        version: 'unknown'
      };

      mockRedisService.getRedisInfo.mockResolvedValue(mockRedisInfo);

      const response = await request(app)
        .get('/api/system/redis')
        .expect(200);

      expect(response.body.connected).toBe(false);
    });
  });

  describe('GET /api/system/overview', () => {
    it('should return system overview', async () => {
      const mockCrewStates = [
        { definition: { id: 'crew-1', name: 'Crew 1', description: '', agents: ['agent-1'], process: 'sequential' as const, tasks: [{ id: 'task-1', description: 'test task', agent: 'agent-1', context: [], tools: [], validateOutput: true, expectedOutput: 'test output' }], sharedContext: {}, maxIterations: 10, verbose: false, timeout: 30000 }, state: null }
      ];
      const mockAgentStates = [
        { definition: { id: 'agent-1', name: 'Agent 1', role: 'test', goal: 'test', backstory: 'test', tools: ['web_scraper'], llm: { provider: 'openai' as const, model: 'gpt-4', temperature: 0.7, maxTokens: 1000 }, maxIterations: 10, verbose: true, allowDelegation: false, timeout: 30000 }, state: null }
      ];
      const mockSystemStats = {
        totalAgents: 5,
        activeAgents: 2,
        totalCrews: 3,
        activeCrews: 1,
        totalTasks: 45,
        completedTasks: 40,
        failedTasks: 5,
        totalTokensUsed: 1000,
        estimatedTotalCost: 10.50,
        uptime: 3600
      };
      
      const mockOverview = {
        crews: mockCrewStates,
        agents: mockAgentStates,
        system: mockSystemStats,
        timestamp: new Date()
      };

      mockCrewRunner.getSystemOverview.mockResolvedValue(mockOverview);

      const response = await request(app)
        .get('/api/system/overview')
        .expect(200);

      expect(response.body.crews).toEqual(mockOverview.crews);
      expect(response.body.agents).toEqual(mockOverview.agents);
      expect(response.body.system).toEqual(mockOverview.system);
      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
      expect(mockCrewRunner.getSystemOverview).toHaveBeenCalled();
    });

    it('should handle overview retrieval errors', async () => {
      mockCrewRunner.getSystemOverview.mockRejectedValue(new Error('Overview failed'));

      const response = await request(app)
        .get('/api/system/overview')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Overview failed'
      });
    });
  });

  describe('GET /api/system/ttl', () => {
    it('should return TTL manager information', async () => {
      const mockCleanupStats = {
        totalKeys: 100,
        activeExecutions: 5,
        lastCleanup: new Date('2025-01-24T10:00:00Z')
      };

      const mockConfig = {
        executions: 3600,
        configs: 86400,
        results: 14400,
        stats: 86400
      };

      mockTTLManager.getCleanupStats.mockResolvedValue(mockCleanupStats);
      mockTTLManager.getConfig.mockReturnValue(mockConfig);

      const response = await request(app)
        .get('/api/system/ttl')
        .expect(200);

      expect(response.body).toEqual({
        config: mockConfig,
        lastCleanup: {
          ...mockCleanupStats,
          lastCleanup: '2025-01-24T10:00:00.000Z'
        },
        status: 'active'
      });
    });

    it('should handle null cleanup stats', async () => {
      const mockConfig = {
        executions: 3600,
        configs: 86400,
        results: 14400,
        stats: 86400
      };

      mockTTLManager.getCleanupStats.mockResolvedValue(null);
      mockTTLManager.getConfig.mockReturnValue(mockConfig);

      const response = await request(app)
        .get('/api/system/ttl')
        .expect(200);

      expect(response.body).toEqual({
        config: mockConfig,
        lastCleanup: null,
        status: 'active'
      });
    });

    it('should handle TTL manager errors', async () => {
      mockTTLManager.getCleanupStats.mockRejectedValue(new Error('TTL error'));

      const response = await request(app)
        .get('/api/system/ttl')
        .expect(500);

      expect(response.body).toEqual({
        error: 'TTL error'
      });
    });
  });

  describe('GET /api/system/executions/active', () => {
    it('should return active executions', async () => {
      const mockActiveExecutions = ['agent_123', 'crew_456', 'agent_789'];
      mockRedisService.getActiveExecutions.mockResolvedValue(mockActiveExecutions);

      const response = await request(app)
        .get('/api/system/executions/active')
        .expect(200);

      expect(response.body).toEqual({
        executions: mockActiveExecutions,
        count: 3
      });
      expect(mockRedisService.getActiveExecutions).toHaveBeenCalled();
    });

    it('should return empty array when no active executions', async () => {
      mockRedisService.getActiveExecutions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/system/executions/active')
        .expect(200);

      expect(response.body).toEqual({
        executions: [],
        count: 0
      });
    });

    it('should handle active executions errors', async () => {
      mockRedisService.getActiveExecutions.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .get('/api/system/executions/active')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Redis error'
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple concurrent requests', async () => {
      // Setup mocks for different endpoints
      mockRedisService.getSystemStats.mockResolvedValue({
        activeExecutions: 5,
        completedToday: 120,
        totalExecutions: 1547,
        redisMemory: '45MB',
        uptime: 3600000,
        connections: 8
      });

      mockRedisService.getRedisInfo.mockResolvedValue({
        connected: true,
        keys: 145,
        memory: '45MB',
        connections: 3,
        version: '7.0.11'
      });

      mockRedisService.getActiveExecutions.mockResolvedValue(['exec_1', 'exec_2']);

      // Make concurrent requests
      const requests = [
        request(app).get('/api/system/stats'),
        request(app).get('/api/system/redis'),
        request(app).get('/api/system/executions/active')
      ];

      const responses = await Promise.all(requests);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);

      expect(responses[0].body.activeExecutions).toBe(5);
      expect(responses[1].body.connected).toBe(true);
      expect(responses[2].body.count).toBe(2);
    });

    it('should handle mixed success and failure responses', async () => {
      mockRedisService.getSystemStats.mockResolvedValue({
        activeExecutions: 5,
        completedToday: 120,
        totalExecutions: 1547,
        redisMemory: '45MB',
        uptime: 3600000,
        connections: 8
      });

      mockRedisService.getRedisInfo.mockRejectedValue(new Error('Redis connection lost'));

      const [statsResponse, redisResponse] = await Promise.all([
        request(app).get('/api/system/stats'),
        request(app).get('/api/system/redis')
      ]);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.activeExecutions).toBe(5);

      expect(redisResponse.status).toBe(500);
      expect(redisResponse.body.error).toBe('Redis connection lost');
    });
  });
});