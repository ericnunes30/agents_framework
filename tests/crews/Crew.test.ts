import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Crew, ProcessContext } from '../../src/crews/Crew.js';
import { Agent } from '../../src/agents/Agent.js';
import { StateManager } from '../../src/state/StateManager.js';
import type { CrewDefinition, TaskDefinition, AgentDefinition } from '../../src/config/schemas.js';

// Mock dependencies
jest.mock('../../src/agents/Agent.js');
jest.mock('../../src/state/StateManager.js');

describe('Crew', () => {
  let mockStateManager: jest.Mocked<StateManager>;
  let mockAgent1: jest.Mocked<Agent>;
  let mockAgent2: jest.Mocked<Agent>;
  let agentsMap: Map<string, Agent>;
  let crewDefinition: CrewDefinition;

  beforeEach(() => {
    // Mock StateManager
    mockStateManager = {
      saveCrewState: jest.fn(),
      getCrewState: jest.fn(),
      deleteCrewState: jest.fn()
    } as any;

    // Mock Agents
    mockAgent1 = {
      executeTask: jest.fn(),
      getDefinition: jest.fn(),
      cancelCurrentTask: jest.fn()
    } as any;

    mockAgent2 = {
      executeTask: jest.fn(),
      getDefinition: jest.fn(),
      cancelCurrentTask: jest.fn()
    } as any;

    // Set up agent definitions
    mockAgent1.getDefinition.mockReturnValue({
      id: 'agent1',
      name: 'Agent 1',
      role: 'Researcher',
      goal: 'Research',
      backstory: 'Research agent',
      llm: { provider: 'openai', model: 'gpt-4.1-mini' }
    } as AgentDefinition);

    mockAgent2.getDefinition.mockReturnValue({
      id: 'agent2',
      name: 'Agent 2',
      role: 'Writer',
      goal: 'Write',
      backstory: 'Writing agent',
      llm: { provider: 'openai', model: 'gpt-4.1-mini' }
    } as AgentDefinition);

    // Create agents map
    agentsMap = new Map();
    agentsMap.set('agent1', mockAgent1);
    agentsMap.set('agent2', mockAgent2);

    // Basic crew definition
    crewDefinition = {
      id: 'test-crew',
      name: 'Test Crew',
      description: 'A test crew',
      agents: ['agent1', 'agent2'],
      process: 'sequential',
      tasks: [
        {
          id: 'task1',
          description: 'First task',
          agent: 'agent1',
          expectedOutput: 'Research results',
          context: [],
          tools: [],
          validateOutput: false
        },
        {
          id: 'task2',
          description: 'Second task',
          agent: 'agent2',
          expectedOutput: 'Written report',
          context: ['task1'],
          tools: [],
          validateOutput: false
        }
      ],
      sharedContext: { project: 'test' },
      maxIterations: 10,
      verbose: false
    };
  });

  describe('Constructor', () => {
    it('should initialize crew with valid definition', () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      expect(crew.getDefinition()).toEqual(crewDefinition);
      
      const state = crew.getState();
      expect(state.id).toBe('test-crew');
      expect(state.name).toBe('Test Crew');
      expect(state.status).toBe('pending');
      expect(state.agents).toHaveProperty('agent1');
      expect(state.agents).toHaveProperty('agent2');
      expect(state.sharedContext).toEqual({ project: 'test' });
      expect(state.metrics.totalAgents).toBe(2);
      expect(state.metrics.totalTasks).toBe(2);
    });

    it('should initialize agent states correctly', () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      const state = crew.getState();
      
      expect(state.agents.agent1.id).toBe('agent1');
      expect(state.agents.agent1.name).toBe('Agent 1');
      expect(state.agents.agent1.status).toBe('pending');
      expect(state.agents.agent1.tasks).toEqual([]);
      expect(state.agents.agent1.tokensUsed).toBe(0);
      
      expect(state.agents.agent2.id).toBe('agent2');
      expect(state.agents.agent2.name).toBe('Agent 2');
      expect(state.agents.agent2.status).toBe('pending');
    });
  });

  describe('Sequential Process', () => {
    it('should execute tasks sequentially', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Research complete');
      mockAgent2.executeTask.mockResolvedValue('Report written');
      
      const results = await crew.execute('Test input');
      
      expect(results).toEqual({
        task1: 'Research complete',
        task2: 'Report written'
      });
      
      expect(mockAgent1.executeTask).toHaveBeenCalledWith(
        'First task',
        expect.objectContaining({
          project: 'test',
          input: 'Test input'
        })
      );
      
      expect(mockAgent2.executeTask).toHaveBeenCalledWith(
        'Second task',
        expect.objectContaining({
          project: 'test',
          input: 'Test input',
          previousResults: { task1: 'Research complete' }
        })
      );
    });

    it('should handle task context dependencies', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Research data');
      mockAgent2.executeTask.mockResolvedValue('Final report');
      
      await crew.execute('Process this data');
      
      // Second task should receive context from first task
      expect(mockAgent2.executeTask).toHaveBeenCalledWith(
        'Second task',
        expect.objectContaining({
          previousResults: { task1: 'Research data' }
        })
      );
    });

    it('should update crew state during execution', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Task 1 result');
      mockAgent2.executeTask.mockResolvedValue('Task 2 result');
      
      await crew.execute('Test input');
      
      const state = crew.getState();
      expect(state.status).toBe('completed');
      expect(state.metrics.completedTasks).toBe(2);
      expect(state.tasks).toHaveProperty('task1');
      expect(state.tasks).toHaveProperty('task2');
      expect(state.startTime).toBeInstanceOf(Date);
      expect(state.endTime).toBeInstanceOf(Date);
    });
  });

  describe('Hierarchical Process', () => {
    it('should execute hierarchical process with manager', async () => {
      const hierarchicalCrew: CrewDefinition = {
        ...crewDefinition,
        process: 'hierarchical'
      };
      
      const crew = new Crew(hierarchicalCrew, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValueOnce('Execution plan')
        .mockResolvedValueOnce('Final review');
      mockAgent2.executeTask.mockResolvedValue('Worker task result');
      
      const results = await crew.execute('Complex task');
      
      expect(results).toHaveProperty('plan');
      expect(results).toHaveProperty('task2');
      expect(results).toHaveProperty('final_review');
      expect(mockAgent1.executeTask).toHaveBeenCalledTimes(2); // Plan + Review
      expect(mockAgent2.executeTask).toHaveBeenCalledTimes(1); // Worker task
    });
  });

  describe('Collaborative Process', () => {
    it('should execute tasks collaboratively', async () => {
      const collaborativeCrew: CrewDefinition = {
        ...crewDefinition,
        process: 'collaborative'
      };
      
      const crew = new Crew(collaborativeCrew, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Agent 1 result');
      mockAgent2.executeTask.mockResolvedValue('Agent 2 result');
      
      const results = await crew.execute('Collaborative task');
      
      expect(results.task1).toBe('Agent 1 result');
      expect(results.task2).toBe('Agent 2 result');
      
      // Both agents should be called
      expect(mockAgent1.executeTask).toHaveBeenCalled();
      expect(mockAgent2.executeTask).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle task execution errors', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockRejectedValue(new Error('Task failed'));
      
      await expect(crew.execute('Test input')).rejects.toThrow('Task failed');
      
      const state = crew.getState();
      expect(state.status).toBe('failed');
      expect(state.error).toBe('Task failed');
      expect(state.metrics.failedTasks).toBe(1);
    });

    it('should handle missing agent error', async () => {
      const invalidCrew: CrewDefinition = {
        ...crewDefinition,
        tasks: [{
          id: 'invalid-task',
          description: 'Task with missing agent',
          agent: 'nonexistent-agent',
          expectedOutput: 'Should fail',
          context: [],
          tools: [],
          validateOutput: false
        }]
      };
      
      const crew = new Crew(invalidCrew, agentsMap, mockStateManager);
      
      await expect(crew.execute('Test input')).rejects.toThrow('Agent not found for task: nonexistent-agent');
    });

    it('should handle unknown process type', async () => {
      const invalidProcessCrew: CrewDefinition = {
        ...crewDefinition,
        process: 'unknown' as any
      };
      
      const crew = new Crew(invalidProcessCrew, agentsMap, mockStateManager);
      
      await expect(crew.execute('Test input')).rejects.toThrow('Unknown process type: unknown');
    });
  });

  describe('State Management', () => {
    it('should save state during execution', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Result');
      mockAgent2.executeTask.mockResolvedValue('Result');
      
      await crew.execute('Test input');
      
      // Should save state multiple times during execution
      expect(mockStateManager.saveCrewState).toHaveBeenCalledWith('test-crew', expect.any(Object));
      expect(mockStateManager.saveCrewState.mock.calls.length).toBeGreaterThan(1);
    });

    it('should update shared context', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      await crew.updateSharedContext({ newData: 'test value' });
      
      const state = crew.getState();
      expect(state.sharedContext).toEqual({
        project: 'test',
        newData: 'test value'
      });
      
      expect(mockStateManager.saveCrewState).toHaveBeenCalledWith('test-crew', state);
    });

    it('should reset crew state', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      // First execute to change state
      mockAgent1.executeTask.mockResolvedValue('Result');
      mockAgent2.executeTask.mockResolvedValue('Result');
      await crew.execute('Test input');
      
      // Then reset
      await crew.reset();
      
      const state = crew.getState();
      expect(state.status).toBe('pending');
      expect(state.tasks).toEqual({});
      expect(state.metrics.completedTasks).toBe(0);
      expect(state.metrics.failedTasks).toBe(0);
      expect(state.error).toBeUndefined();
      expect(state.startTime).toBeUndefined();
      expect(state.endTime).toBeUndefined();
    });
  });

  describe('Metrics and Performance', () => {
    it('should calculate performance metrics', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      mockAgent1.executeTask.mockResolvedValue('Result 1');
      mockAgent2.executeTask.mockResolvedValue('Result 2');
      
      await crew.execute('Test input');
      
      const metrics = crew.getMetrics();
      expect(metrics.successRate).toBe(100); // 2/2 tasks completed
      expect(metrics.currentStatus).toBe('completed');
      expect(metrics.totalTasks).toBe(2);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.totalRuntime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate success rate with failures', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      // Manually set some metrics to simulate partial failure
      const state = crew.getState();
      state.metrics.totalTasks = 4;
      state.metrics.completedTasks = 3;
      state.metrics.failedTasks = 1;
      
      const metrics = crew.getMetrics();
      expect(metrics.successRate).toBe(75); // 3/4 tasks completed
    });
  });

  describe('Event Emission', () => {
    it('should emit crew lifecycle events', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      const crewStartedSpy = jest.fn();
      const crewCompletedSpy = jest.fn();
      const taskStartedSpy = jest.fn();
      const taskCompletedSpy = jest.fn();
      
      crew.on('crew_started', crewStartedSpy);
      crew.on('crew_completed', crewCompletedSpy);
      crew.on('task_started', taskStartedSpy);
      crew.on('task_completed', taskCompletedSpy);
      
      mockAgent1.executeTask.mockResolvedValue('Result 1');
      mockAgent2.executeTask.mockResolvedValue('Result 2');
      
      await crew.execute('Test input');
      
      expect(crewStartedSpy).toHaveBeenCalledWith({ crewId: 'test-crew', input: 'Test input' });
      expect(crewCompletedSpy).toHaveBeenCalledWith(expect.objectContaining({
        crewId: 'test-crew',
        results: { task1: 'Result 1', task2: 'Result 2' }
      }));
      expect(taskStartedSpy).toHaveBeenCalledTimes(2);
      expect(taskCompletedSpy).toHaveBeenCalledTimes(2);
    });

    it('should emit failure events on error', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      const crewFailedSpy = jest.fn();
      const taskFailedSpy = jest.fn();
      
      crew.on('crew_failed', crewFailedSpy);
      crew.on('task_failed', taskFailedSpy);
      
      mockAgent1.executeTask.mockRejectedValue(new Error('Task error'));
      
      await expect(crew.execute('Test input')).rejects.toThrow();
      
      expect(crewFailedSpy).toHaveBeenCalledWith({ crewId: 'test-crew', error: 'Task error' });
      expect(taskFailedSpy).toHaveBeenCalledWith(expect.objectContaining({
        crewId: 'test-crew',
        taskId: 'task1',
        error: 'Task error'
      }));
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel crew execution', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      // Set state to running
      const state = crew.getState();
      state.status = 'running';
      
      await crew.cancel();
      
      expect(crew.getState().status).toBe('cancelled');
      expect(mockAgent1.cancelCurrentTask).toHaveBeenCalled();
      expect(mockAgent2.cancelCurrentTask).toHaveBeenCalled();
    });

    it('should not cancel if not running', async () => {
      const crew = new Crew(crewDefinition, agentsMap, mockStateManager);
      
      await crew.cancel();
      
      // Should remain pending
      expect(crew.getState().status).toBe('pending');
      expect(mockAgent1.cancelCurrentTask).not.toHaveBeenCalled();
    });
  });
});