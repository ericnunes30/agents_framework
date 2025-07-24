import request from 'supertest';
import express from 'express';
import { createCrewsRouter } from '../../../src/http/routes/crews.js';
import { CrewRunner } from '../../../src/crews/CrewRunner.js';
import { AgentRunner } from '../../../src/agents/AgentRunner.js';
import { RedisService } from '../../../src/http/services/RedisService.js';

// Mock dependencies
jest.mock('../../../src/crews/CrewRunner.js');
jest.mock('../../../src/agents/AgentRunner.js');
jest.mock('../../../src/http/services/RedisService.js');

const MockedCrewRunner = CrewRunner as jest.MockedClass<typeof CrewRunner>;
const MockedAgentRunner = AgentRunner as jest.MockedClass<typeof AgentRunner>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('Crews Routes', () => {
  let app: express.Application;
  let mockCrewRunner: jest.Mocked<CrewRunner>;
  let mockAgentRunner: jest.Mocked<AgentRunner>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockCrewRunner = {
      getAllCrewStates: jest.fn(),
      getCrewState: jest.fn(),
      createCrewFromConfig: jest.fn(),
      executeCrewWithContext: jest.fn(),
      getCrewLogs: jest.fn(),
      resetCrew: jest.fn(),
      getCrew: jest.fn()
    } as any;

    mockAgentRunner = {} as any;

    mockRedisService = {
      createExecution: jest.fn(),
      getExecutionStatus: jest.fn(),
      getExecutionResult: jest.fn(),
      getActiveExecutions: jest.fn(),
      updateExecutionStatus: jest.fn(),
      incrementCompletedCount: jest.fn()
    } as any;

    MockedCrewRunner.mockImplementation(() => mockCrewRunner);
    MockedAgentRunner.mockImplementation(() => mockAgentRunner);
    MockedRedisService.mockImplementation(() => mockRedisService);

    app = express();
    app.use(express.json());
    app.use('/api/crews', createCrewsRouter(mockCrewRunner, mockAgentRunner, mockRedisService));

    jest.clearAllMocks();
  });

  describe('GET /api/crews', () => {
    it('should return all crew states', async () => {
      const mockCrews = [
        { 
          definition: { 
            id: 'crew-1', 
            name: 'Crew 1', 
            description: 'Test crew 1', 
            agents: ['agent-1'], 
            process: 'sequential' as const, 
            tasks: [
              {
                id: 'task-1',
                description: 'Test task',
                agent: 'agent-1',
                context: [],
                tools: [],
                validateOutput: false
              }
            ], 
            sharedContext: {}, 
            maxIterations: 10, 
            verbose: false, 
            timeout: 30000 
          },
          state: { 
            id: 'crew-1', 
            name: 'Crew 1', 
            status: 'pending' as const, 
            agents: {}, 
            tasks: {}, 
            sharedContext: {}, 
            metrics: { totalAgents: 1, completedAgents: 0, totalTasks: 1, completedTasks: 0, failedTasks: 0, totalRuntime: 0, estimatedCost: 0 } 
          }
        },
        { 
          definition: { 
            id: 'crew-2', 
            name: 'Crew 2', 
            description: 'Test crew 2', 
            agents: ['agent-2'], 
            process: 'hierarchical' as const, 
            tasks: [
              {
                id: 'task-2',
                description: 'Test task 2',
                agent: 'agent-2',
                context: [],
                tools: [],
                validateOutput: false
              }
            ], 
            sharedContext: {}, 
            maxIterations: 10, 
            verbose: false, 
            timeout: 30000 
          },
          state: { 
            id: 'crew-2', 
            name: 'Crew 2', 
            status: 'running' as const, 
            agents: {}, 
            tasks: {}, 
            sharedContext: {}, 
            metrics: { totalAgents: 1, completedAgents: 0, totalTasks: 1, completedTasks: 0, failedTasks: 0, totalRuntime: 2000, estimatedCost: 0.05 } 
          }
        }
      ];
      mockCrewRunner.getAllCrewStates.mockResolvedValue(mockCrews);

      const response = await request(app)
        .get('/api/crews')
        .expect(200);

      expect(response.body).toEqual(mockCrews);
    });
  });

  describe('POST /api/crews', () => {
    it('should create new crew from config', async () => {
      const mockCrew = {
        getDefinition: () => ({ id: 'crew-123', name: 'Test Crew' })
      };
      mockCrewRunner.createCrewFromConfig.mockResolvedValue(mockCrew as any);

      const response = await request(app)
        .post('/api/crews')
        .send({ configPath: 'examples/crews/test-crew.yaml' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Crew created successfully',
        crewId: 'crew-123'
      });
    });
  });

  describe('POST /api/crews/execute', () => {
    it('should execute crew and return execution ID', async () => {
      mockRedisService.createExecution.mockResolvedValue('crew_abc123');

      const response = await request(app)
        .post('/api/crews/execute')
        .send({
          configPath: 'examples/crews/research-crew.yaml',
          input: 'Analyze market trends',
          options: { maxIterations: 10 }
        })
        .expect(200);

      expect(response.body).toEqual({
        executionId: 'crew_abc123',
        status: 'started'
      });

      expect(mockRedisService.createExecution).toHaveBeenCalledWith(
        'crew',
        {
          configPath: 'examples/crews/research-crew.yaml',
          input: 'Analyze market trends',
          task: undefined
        },
        3600 // Default TTL
      );
    });
  });

  describe('GET /api/crews/status/:executionId', () => {
    it('should return execution status', async () => {
      const mockStatus = {
        executionId: 'crew_abc123',
        status: 'running' as const,
        progress: 0.4,
        currentStep: 'task_2',
        startTime: new Date('2025-01-24T10:00:00Z'),
        metadata: {
          configPath: 'examples/crews/research-crew.yaml',
          input: 'Analyze market trends'
        }
      };
      mockRedisService.getExecutionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/crews/status/crew_abc123')
        .expect(200);

      expect(response.body).toMatchObject({
        executionId: 'crew_abc123',
        status: 'running',
        progress: 0.4
      });
    });
  });

  describe('GET /api/crews/active', () => {
    it('should return active crew executions only', async () => {
      mockRedisService.getActiveExecutions.mockResolvedValue([
        'agent_123', 'crew_456', 'crew_789'
      ]);

      const response = await request(app)
        .get('/api/crews/active')
        .expect(200);

      expect(response.body).toEqual({
        executions: ['crew_456', 'crew_789'] // Only crew executions
      });
    });
  });

  describe('POST /api/crews/:crewId/execute (legacy)', () => {
    it('should execute crew with input', async () => {
      const mockResult = { result: 'Crew execution completed', stats: {} };
      mockCrewRunner.executeCrewWithContext.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/crews/crew-123/execute')
        .send({
          input: 'Analyze healthcare AI',
          context: { region: 'North America' }
        })
        .expect(200);

      expect(response.body).toEqual({ result: mockResult });
      expect(mockCrewRunner.executeCrewWithContext).toHaveBeenCalledWith(
        'crew-123',
        'Analyze healthcare AI',
        { region: 'North America' }
      );
    });

    it('should return 400 when input missing', async () => {
      const response = await request(app)
        .post('/api/crews/crew-123/execute')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'input is required' });
    });
  });

  describe('GET /api/crews/:crewId/logs', () => {
    it('should return crew execution logs', async () => {
      const mockLogs = [
        { timestamp: new Date(), level: 'info', message: 'Started task 1' },
        { timestamp: new Date(), level: 'info', message: 'Completed task 1' }
      ];
      mockCrewRunner.getCrewLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/crews/crew-123/logs')
        .expect(200);

      expect(response.body).toEqual([
        { timestamp: mockLogs[0].timestamp.toISOString(), level: 'info', message: 'Started task 1' },
        { timestamp: mockLogs[1].timestamp.toISOString(), level: 'info', message: 'Completed task 1' }
      ]);
      expect(mockCrewRunner.getCrewLogs).toHaveBeenCalledWith('crew-123', 50);
    });

    it('should use custom limit parameter', async () => {
      mockCrewRunner.getCrewLogs.mockResolvedValue([]);

      await request(app)
        .get('/api/crews/crew-123/logs?limit=100')
        .expect(200);

      expect(mockCrewRunner.getCrewLogs).toHaveBeenCalledWith('crew-123', 100);
    });
  });

  describe('POST /api/crews/:crewId/cancel', () => {
    it('should cancel crew execution', async () => {
      const mockCrew = {
        cancel: jest.fn().mockResolvedValue(undefined)
      };
      mockCrewRunner.getCrew.mockReturnValue(mockCrew as any);

      const response = await request(app)
        .post('/api/crews/crew-123/cancel')
        .expect(200);

      expect(response.body).toEqual({ message: 'Crew execution cancelled' });
      expect(mockCrew.cancel).toHaveBeenCalled();
    });

    it('should return 404 when crew not found', async () => {
      mockCrewRunner.getCrew.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/crews/nonexistent/cancel')
        .expect(404);

      expect(response.body).toEqual({ error: 'Crew not found' });
    });
  });
});