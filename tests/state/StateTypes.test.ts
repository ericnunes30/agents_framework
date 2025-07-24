import { describe, it, expect } from '@jest/globals';
import type { 
  AgentState, 
  CrewState, 
  TaskResult, 
  StateEvent,
  AgentStatus,
  CrewStatus,
  StateEventType
} from '../../src/state/types.js';

describe('State Management Types', () => {
  describe('AgentState', () => {
    it('should create valid agent state', () => {
      const agentState: AgentState = {
        id: 'agent-1',
        name: 'Test Agent',
        status: 'pending',
        tasks: [],
        context: {},
        tokensUsed: 0,
        metrics: {
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          totalRuntime: 0,
          averageTaskTime: 0
        }
      };

      expect(agentState.status).toBe('pending');
      expect(agentState.id).toBe('agent-1');
      expect(agentState.name).toBe('Test Agent');
    });

    it('should support all agent statuses', () => {
      const statuses: AgentStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      
      statuses.forEach(status => {
        const agentState: AgentState = {
          id: 'agent-1',
          name: 'Test Agent',
          status,
          tasks: [],
          context: {},
          tokensUsed: 0,
          metrics: {
            totalTasks: 0,
            successfulTasks: 0,
            failedTasks: 0,
            totalRuntime: 0,
            averageTaskTime: 0
          }
        };

        expect(agentState.status).toBe(status);
      });
    });

    it('should handle running agent state', () => {
      const runningState: AgentState = {
        id: 'agent-1',
        name: 'Test Agent',
        status: 'running',
        currentTask: 'Processing user request',
        tasks: [],
        context: {},
        tokensUsed: 0,
        metrics: {
          totalTasks: 1,
          successfulTasks: 0,
          failedTasks: 0,
          totalRuntime: 180000,
          averageTaskTime: 180000
        }
      };

      expect(runningState.status).toBe('running');
      expect(runningState.currentTask).toBe('Processing user request');
    });
  });

  describe('CrewState', () => {
    it('should create valid crew state', () => {
      const crewState: CrewState = {
        id: 'crew-1',
        name: 'Test Crew',
        status: 'pending',
        agents: {},
        tasks: {},
        sharedContext: {},
        metrics: {
          totalAgents: 0,
          completedAgents: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalRuntime: 0,
          estimatedCost: 0
        }
      };

      expect(crewState.status).toBe('pending');
      expect(crewState.id).toBe('crew-1');
      expect(crewState.name).toBe('Test Crew');
    });

    it('should support all crew statuses', () => {
      const statuses: CrewStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      
      statuses.forEach(status => {
        const crewState: CrewState = {
          id: 'crew-1',
          name: 'Test Crew',
          status,
          agents: {},
          tasks: {},
          sharedContext: {},
          metrics: {
            totalAgents: 0,
            completedAgents: 0,
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalRuntime: 0,
            estimatedCost: 0
          }
        };

        expect(crewState.status).toBe(status);
      });
    });
  });

  describe('TaskResult', () => {
    it('should create valid task result', () => {
      const taskResult: TaskResult = {
        id: 'task-result-123',
        agentId: 'agent-1',
        taskId: 'task-1',
        output: 'Market analysis shows positive growth trends',
        metadata: {
          tokensUsed: 450,
          model: 'gpt-4',
          provider: 'openai',
          duration: 15000,
          timestamp: new Date('2024-01-01T10:00:15Z'),
          cost: 0.002
        },
        status: 'success'
      };

      expect(taskResult.id).toBe('task-result-123');
      expect(taskResult.agentId).toBe('agent-1');
      expect(taskResult.taskId).toBe('task-1');
      expect(taskResult.status).toBe('success');
      expect(taskResult.metadata.tokensUsed).toBe(450);
    });
  });

  describe('StateEvent', () => {
    it('should create agent state event', () => {
      const agentEvent: StateEvent = {
        type: 'agent_started',
        entityType: 'agent',
        entityId: 'agent-1',
        data: {
          id: 'agent-1',
          name: 'Test Agent',
          status: 'running',
          tasks: [],
          context: {},
          tokensUsed: 0,
          metrics: {
            totalTasks: 1,
            successfulTasks: 0,
            failedTasks: 0,
            totalRuntime: 0,
            averageTaskTime: 0
          }
        },
        timestamp: new Date()
      };

      expect(agentEvent.entityType).toBe('agent');
      expect(agentEvent.entityId).toBe('agent-1');
      expect(agentEvent.type).toBe('agent_started');
    });

    it('should create crew state event', () => {
      const crewEvent: StateEvent = {
        type: 'crew_started',
        entityType: 'crew',
        entityId: 'crew-1',
        data: {
          id: 'crew-1',
          name: 'Test Crew',
          status: 'running',
          agents: {},
          tasks: {},
          sharedContext: {},
          metrics: {
            totalAgents: 2,
            completedAgents: 1,
            totalTasks: 3,
            completedTasks: 2,
            failedTasks: 0,
            totalRuntime: 0,
            estimatedCost: 0
          }
        },
        timestamp: new Date()
      };

      expect(crewEvent.entityType).toBe('crew');
      expect(crewEvent.entityId).toBe('crew-1');
      expect(crewEvent.type).toBe('crew_started');
    });
  });
});