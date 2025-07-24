import request from 'supertest';
import express from 'express';
import { createConfigRouter } from '../../../src/http/routes/config.js';
import { CrewRunner } from '../../../src/crews/CrewRunner.js';
import { RedisService } from '../../../src/http/services/RedisService.js';
import { ConfigLoader } from '../../../src/config/loader.js';

// Mock dependencies
jest.mock('../../../src/crews/CrewRunner.js');
jest.mock('../../../src/http/services/RedisService.js');
jest.mock('../../../src/config/loader.js', () => ({
  ConfigLoader: {
    loadAllAgents: jest.fn(),
    loadAllCrews: jest.fn(),
    loadAgentConfig: jest.fn(),
    loadCrewConfig: jest.fn()
  }
}));

const MockedCrewRunner = CrewRunner as jest.MockedClass<typeof CrewRunner>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('Config Routes', () => {
  let app: express.Application;
  let mockCrewRunner: jest.Mocked<CrewRunner>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockCrewRunner = {
      validateCrew: jest.fn().mockReturnValue({ valid: true, errors: [] })
    } as any;

    mockRedisService = {
      getCachedConfig: jest.fn(),
      cacheConfig: jest.fn()
    } as any;

    MockedCrewRunner.mockImplementation(() => mockCrewRunner);
    MockedRedisService.mockImplementation(() => mockRedisService);

    // Static methods are already mocked in the jest.mock() call above

    app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRouter(mockCrewRunner, mockRedisService));

    jest.clearAllMocks();
  });

  describe('GET /api/config/agents', () => {
    it('should return cached agent configs list', async () => {
      const cachedAgents = [
        { id: 'agent-1', name: 'Agent 1', role: 'researcher' }
      ];
      mockRedisService.getCachedConfig.mockResolvedValue(cachedAgents);

      const response = await request(app)
        .get('/api/config/agents')
        .expect(200);

      expect(response.body).toEqual(cachedAgents);
      expect(mockRedisService.getCachedConfig).toHaveBeenCalledWith('config:agents:list');
    });

    it('should load and cache agent configs when not cached', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', role: 'researcher', backstory: 'A research agent...' }
      ];
      mockRedisService.getCachedConfig.mockResolvedValue(null);
      (ConfigLoader.loadAllAgents as jest.Mock).mockReturnValue(mockAgents);

      const response = await request(app)
        .get('/api/config/agents')
        .expect(200);

      expect(response.body).toEqual([
        { id: 'agent-1', name: 'Agent 1', role: 'researcher', description: 'A research agent......' }
      ]);
      expect(mockRedisService.cacheConfig).toHaveBeenCalled();
    });
  });

  describe('GET /api/config/crews', () => {
    it('should return crew configs with metadata', async () => {
      const mockCrews = [
        { id: 'crew-1', name: 'Research Crew', process: 'sequential', agents: ['agent-1'], tasks: ['task-1', 'task-2'] }
      ];
      mockRedisService.getCachedConfig.mockResolvedValue(null);
      (ConfigLoader.loadAllCrews as jest.Mock).mockReturnValue(mockCrews);

      const response = await request(app)
        .get('/api/config/crews')
        .expect(200);

      expect(response.body).toEqual([
        { id: 'crew-1', name: 'Research Crew', process: 'sequential', agents: 1, tasks: 2 }
      ]);
    });
  });

  describe('POST /api/config/validate', () => {
    it('should validate agent configuration', async () => {
      const agentConfig = { id: 'test-agent', name: 'Test Agent' };
      (ConfigLoader.loadAgentConfig as jest.Mock).mockReturnValue(agentConfig);

      const response = await request(app)
        .post('/api/config/validate')
        .send({ type: 'agent', configPath: 'test-agent.yaml' })
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        config: agentConfig,
        type: 'agent'
      });
    });

    it('should validate crew configuration', async () => {
      const crewConfig = { id: 'test-crew', name: 'Test Crew' };
      const validation = { valid: true, errors: [] };
      (ConfigLoader.loadCrewConfig as jest.Mock).mockReturnValue(crewConfig);
      mockCrewRunner.validateCrew.mockReturnValue(validation);

      const response = await request(app)
        .post('/api/config/validate')
        .send({ type: 'crew', configPath: 'test-crew.yaml' })
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        config: crewConfig,
        errors: [],
        type: 'crew'
      });
    });

    it('should return validation errors', async () => {
      (ConfigLoader.loadAgentConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid configuration');
      });

      const response = await request(app)
        .post('/api/config/validate')
        .send({ type: 'agent', configPath: 'invalid.yaml' })
        .expect(400);

      expect(response.body).toEqual({
        valid: false,
        error: 'Invalid configuration'
      });
    });
  });
});