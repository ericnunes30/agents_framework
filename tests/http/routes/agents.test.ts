import request from 'supertest';
import express from 'express';
import { createAgentsRouter } from '../../../src/http/routes/agents.js';
import { AgentRunner } from '../../../src/agents/AgentRunner.js';
import { RedisService } from '../../../src/http/services/RedisService.js';
import { ExecutionStatus } from '../../../src/http/types.js';

// Mock dependencies
jest.mock('../../../src/agents/AgentRunner.js');
jest.mock('../../../src/http/services/RedisService.js');

const MockedAgentRunner = AgentRunner as jest.MockedClass<typeof AgentRunner>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('Agents Routes', () => {
  let app: express.Application;
  let mockAgentRunner: jest.Mocked<AgentRunner>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Create mock instances
    mockAgentRunner = {
      getAllAgentStates: jest.fn(),
      getAgentState: jest.fn(),
      createAgentFromConfig: jest.fn(),
      executeTask: jest.fn(),
      resetAgent: jest.fn()
    } as any;

    mockRedisService = {
      createExecution: jest.fn(),
      getExecutionStatus: jest.fn(),
      getExecutionResult: jest.fn(),
      getActiveExecutions: jest.fn(),
      updateExecutionStatus: jest.fn(),
      incrementCompletedCount: jest.fn()
    } as any;

    MockedAgentRunner.mockImplementation(() => mockAgentRunner);
    MockedRedisService.mockImplementation(() => mockRedisService);

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/agents', createAgentsRouter(mockAgentRunner, mockRedisService));

    jest.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return all agent states', async () => {
      const mockAgents = [
        { 
          definition: { 
            id: 'agent-1', 
            name: 'Agent 1', 
            role: 'test', 
            goal: 'test', 
            backstory: 'test', 
            tools: ['web-scraper'], 
            llm: { provider: 'openai' as const, model: 'gpt-4', temperature: 0.7, maxTokens: 1000 }, 
            maxIterations: 10, 
            verbose: true, 
            timeout: 30000 
          },
          state: { 
            id: 'agent-1', 
            name: 'Agent 1', 
            status: 'pending' as const, 
            tasks: [], 
            context: {}, 
            tokensUsed: 0, 
            metrics: { totalTasks: 0, successfulTasks: 0, failedTasks: 0, totalRuntime: 0, averageTaskTime: 0 } 
          }
        },
        { 
          definition: { 
            id: 'agent-2', 
            name: 'Agent 2', 
            role: 'test', 
            goal: 'test', 
            backstory: 'test', 
            tools: ['redis'], 
            llm: { provider: 'openai' as const, model: 'gpt-4', temperature: 0.7, maxTokens: 1000 }, 
            maxIterations: 10, 
            verbose: true, 
            timeout: 30000 
          },
          state: { 
            id: 'agent-2', 
            name: 'Agent 2', 
            status: 'running' as const, 
            tasks: [], 
            context: {}, 
            tokensUsed: 0, 
            metrics: { totalTasks: 0, successfulTasks: 0, failedTasks: 0, totalRuntime: 0, averageTaskTime: 0 } 
          }
        }
      ];
      mockAgentRunner.getAllAgentStates.mockResolvedValue(mockAgents);

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toEqual(mockAgents);
      expect(mockAgentRunner.getAllAgentStates).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockAgentRunner.getAllAgentStates.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/agents')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Database error'
      });
    });
  });

  describe('GET /api/agents/:agentId', () => {
    it('should return specific agent state', async () => {
      const mockAgent = { id: 'agent-123', name: 'Agent 123', status: 'running' as const, tasks: [], context: {}, tokensUsed: 0, metrics: { totalTasks: 0, successfulTasks: 0, failedTasks: 0, totalRuntime: 0, averageTaskTime: 0 } };
      mockAgentRunner.getAgentState.mockResolvedValue(mockAgent);

      const response = await request(app)
        .get('/api/agents/agent-123')
        .expect(200);

      expect(response.body).toEqual(mockAgent);
      expect(mockAgentRunner.getAgentState).toHaveBeenCalledWith('agent-123');
    });

    it('should return 404 when agent not found', async () => {
      mockAgentRunner.getAgentState.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/agents/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Agent not found' });
    });
  });

  describe('POST /api/agents', () => {
    it('should create new agent from config', async () => {
      const mockAgent = {
        getDefinition: () => ({ id: 'agent-123', name: 'Test Agent' })
      };
      mockAgentRunner.createAgentFromConfig.mockResolvedValue(mockAgent as any);

      const response = await request(app)
        .post('/api/agents')
        .send({ configPath: 'examples/agents/basic-agent.yaml' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Agent created successfully',
        agentId: 'agent-123'
      });
      expect(mockAgentRunner.createAgentFromConfig).toHaveBeenCalledWith(
        'examples/agents/basic-agent.yaml'
      );
    });

    it('should return 400 when configPath missing', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'configPath is required' });
    });

    it('should handle creation errors', async () => {
      mockAgentRunner.createAgentFromConfig.mockRejectedValue(new Error('Invalid config'));

      const response = await request(app)
        .post('/api/agents')
        .send({ configPath: 'invalid.yaml' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid config' });
    });
  });

  describe('POST /api/agents/execute', () => {
    it('should execute agent and return execution ID', async () => {
      mockRedisService.createExecution.mockResolvedValue('agent_abc123');

      const response = await request(app)
        .post('/api/agents/execute')
        .send({
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Research AI trends',
          options: { timeout: 60000 }
        })
        .expect(200);

      expect(response.body).toEqual({
        executionId: 'agent_abc123',
        status: 'started'
      });

      expect(mockRedisService.createExecution).toHaveBeenCalledWith(
        'agent',
        {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Research AI trends',
          input: undefined
        },
        3600
      );
    });

    it('should use default TTL when not provided', async () => {
      mockRedisService.createExecution.mockResolvedValue('agent_def456');

      await request(app)
        .post('/api/agents/execute')
        .send({
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Test task'
        })
        .expect(200);

      expect(mockRedisService.createExecution).toHaveBeenCalledWith(
        'agent',
        expect.any(Object),
        3600 // Default TTL
      );
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/agents/execute')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('GET /api/agents/status/:executionId', () => {
    it('should return execution status', async () => {
      const mockStatus: ExecutionStatus = {
        executionId: 'agent_abc123',
        status: 'running',
        progress: 0.5,
        startTime: new Date('2025-01-24T10:00:00Z'),
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Research AI trends'
        }
      };
      mockRedisService.getExecutionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/agents/status/agent_abc123')
        .expect(200);

      expect(response.body).toEqual({
        ...mockStatus,
        startTime: '2025-01-24T10:00:00.000Z'
      });
    });

    it('should return 404 when execution not found', async () => {
      mockRedisService.getExecutionStatus.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/agents/status/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Execution not found' });
    });
  });

  describe('GET /api/agents/results/:executionId', () => {
    it('should return execution results', async () => {
      const mockResult = {
        executionId: 'agent_abc123',
        result: 'Final result',
        metadata: {
          configPath: 'examples/agents/basic-agent.yaml',
          task: 'Research AI trends',
          tokensUsed: 1500
        },
        executionTime: 45000,
        completedAt: new Date('2025-01-24T10:01:30Z')
      };
      mockRedisService.getExecutionResult.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/agents/results/agent_abc123')
        .expect(200);

      expect(response.body).toEqual({
        ...mockResult,
        completedAt: '2025-01-24T10:01:30.000Z'
      });
    });

    it('should return 404 when result not found', async () => {
      mockRedisService.getExecutionResult.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/agents/results/nonexistent')
        .expect(404);

      expect(response.body).toEqual({ 
        error: 'Result not found or execution not completed' 
      });
    });
  });

  describe('GET /api/agents/active', () => {
    it('should return active agent executions', async () => {
      mockRedisService.getActiveExecutions.mockResolvedValue([
        'agent_123', 'crew_456', 'agent_789'
      ]);

      const response = await request(app)
        .get('/api/agents/active')
        .expect(200);

      expect(response.body).toEqual({
        executions: ['agent_123', 'agent_789'] // Only agent executions
      });
    });

    it('should return empty array when no active executions', async () => {
      mockRedisService.getActiveExecutions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/agents/active')
        .expect(200);

      expect(response.body).toEqual({
        executions: []
      });
    });
  });

  describe('POST /api/agents/:agentId/execute (legacy)', () => {
    it('should execute task with existing agent', async () => {
      const mockResult = 'Task completed successfully';
      mockAgentRunner.executeTask.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/agents/agent-123/execute')
        .send({
          task: 'Research AI trends',
          context: { focus: 'healthcare' }
        })
        .expect(200);

      expect(response.body).toEqual({ result: mockResult });
      expect(mockAgentRunner.executeTask).toHaveBeenCalledWith(
        'agent-123',
        'Research AI trends',
        { focus: 'healthcare' }
      );
    });

    it('should return 400 when task missing', async () => {
      const response = await request(app)
        .post('/api/agents/agent-123/execute')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'task is required' });
    });

    it('should use empty context when not provided', async () => {
      mockAgentRunner.executeTask.mockResolvedValue('Result');

      await request(app)
        .post('/api/agents/agent-123/execute')
        .send({ task: 'Test task' })
        .expect(200);

      expect(mockAgentRunner.executeTask).toHaveBeenCalledWith(
        'agent-123',
        'Test task',
        {}
      );
    });
  });

  describe('POST /api/agents/:agentId/reset (legacy)', () => {
    it('should reset agent successfully', async () => {
      mockAgentRunner.resetAgent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/agents/agent-123/reset')
        .expect(200);

      expect(response.body).toEqual({ message: 'Agent reset successfully' });
      expect(mockAgentRunner.resetAgent).toHaveBeenCalledWith('agent-123');
    });

    it('should handle reset errors', async () => {
      mockAgentRunner.resetAgent.mockRejectedValue(new Error('Reset failed'));

      const response = await request(app)
        .post('/api/agents/agent-123/reset')
        .expect(500);

      expect(response.body).toEqual({ error: 'Reset failed' });
    });
  });

  describe('async execution handling', () => {
    it('should handle async execution success', (done) => {
      mockRedisService.createExecution.mockResolvedValue('exec_123');
      mockAgentRunner.createAgentFromConfig.mockResolvedValue({
        getDefinition: () => ({ id: 'agent-123' })
      } as any);
      mockAgentRunner.executeTask.mockResolvedValue('Success result');
      mockRedisService.updateExecutionStatus.mockResolvedValue();
      mockRedisService.incrementCompletedCount.mockResolvedValue();

      request(app)
        .post('/api/agents/execute')
        .send({
          configPath: 'examples/agents/test.yaml',
          task: 'Test task'
        })
        .expect(200)
        .end(() => {
          // Give async execution time to complete
          setTimeout(() => {
            expect(mockRedisService.updateExecutionStatus).toHaveBeenCalledWith(
              'exec_123',
              'completed',
              1.0,
              'completed',
              'Success result'
            );
            expect(mockRedisService.incrementCompletedCount).toHaveBeenCalled();
            done();
          }, 100);
        });
    });

    it('should handle async execution failure', (done) => {
      mockRedisService.createExecution.mockResolvedValue('exec_123');
      mockAgentRunner.createAgentFromConfig.mockRejectedValue(new Error('Config error'));
      mockRedisService.updateExecutionStatus.mockResolvedValue();

      request(app)
        .post('/api/agents/execute')
        .send({
          configPath: 'invalid.yaml',
          task: 'Test task'
        })
        .expect(200)
        .end(() => {
          // Give async execution time to complete
          setTimeout(() => {
            expect(mockRedisService.updateExecutionStatus).toHaveBeenCalledWith(
              'exec_123',
              'failed',
              undefined,
              'failed',
              undefined,
              'Config error'
            );
            done();
          }, 100);
        });
    });
  });
});