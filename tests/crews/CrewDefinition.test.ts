import { describe, it, expect } from '@jest/globals';
import { CrewDefinitionSchema, TaskDefinitionSchema } from '../../src/config/schemas.js';
import type { CrewDefinition, TaskDefinition } from '../../src/config/schemas.js';

describe('Crew Configuration', () => {
  describe('TaskDefinition', () => {
    it('should validate valid task definition', () => {
      const validTask: TaskDefinition = {
        id: 'test-task',
        description: 'Test task description',
        agent: 'test-agent',
        expectedOutput: 'Expected output',
        context: [],
        tools: [],
        validateOutput: false,
        outputKey: 'task_result'
      };

      const result = TaskDefinitionSchema.parse(validTask);
      
      expect(result.id).toBe('test-task');
      expect(result.description).toBe('Test task description');
      expect(result.agent).toBe('test-agent');
      expect(result.context).toEqual([]);
      expect(result.tools).toEqual([]);
      expect(result.validateOutput).toBe(false);
    });

    it('should apply default values for optional fields', () => {
      const minimalTask = {
        id: 'minimal-task',
        description: 'Minimal task',
        agent: 'agent1'
      };

      const result = TaskDefinitionSchema.parse(minimalTask);
      
      expect(result.context).toEqual([]);
      expect(result.tools).toEqual([]);
      expect(result.validateOutput).toBe(false);
    });

    it('should validate task with context dependencies', () => {
      const taskWithContext: TaskDefinition = {
        id: 'dependent-task',
        description: 'Task with dependencies',
        agent: 'agent1',
        context: ['task1', 'task2'],
        tools: ['web-scraper'],
        validateOutput: true,
        expectedOutput: 'Processed result',
        outputKey: 'processed_data'
      };

      const result = TaskDefinitionSchema.parse(taskWithContext);
      
      expect(result.context).toEqual(['task1', 'task2']);
      expect(result.tools).toEqual(['web-scraper']);
      expect(result.validateOutput).toBe(true);
    });

    it('should reject invalid task definition', () => {
      const invalidTask = {
        id: '', // Empty ID should fail
        description: 'Test task',
        agent: 'agent1'
      };

      expect(() => {
        TaskDefinitionSchema.parse(invalidTask);
      }).toThrow();
    });
  });

  describe('CrewDefinition', () => {
    it('should validate valid crew definition', () => {
      const validCrew: CrewDefinition = {
        id: 'test-crew',
        name: 'Test Crew',
        description: 'A test crew for validation',
        agents: ['agent1', 'agent2'],
        process: 'sequential',
        tasks: [
          {
            id: 'task1',
            description: 'First task',
            agent: 'agent1',
            expectedOutput: 'Task 1 result',
            context: [],
            tools: [],
            validateOutput: false
          }
        ],
        sharedContext: {},
        maxIterations: 10,
        verbose: false
      };

      const result = CrewDefinitionSchema.parse(validCrew);
      
      expect(result.id).toBe('test-crew');
      expect(result.name).toBe('Test Crew');
      expect(result.process).toBe('sequential');
      expect(result.agents).toEqual(['agent1', 'agent2']);
      expect(result.tasks).toHaveLength(1);
    });

    it('should apply default values', () => {
      const minimalCrew = {
        id: 'minimal-crew',
        name: 'Minimal Crew',
        description: 'Minimal crew',
        agents: ['agent1'],
        tasks: [
          {
            id: 'task1',
            description: 'Only task',
            agent: 'agent1'
          }
        ]
      };

      const result = CrewDefinitionSchema.parse(minimalCrew);
      
      expect(result.process).toBe('sequential');
      expect(result.sharedContext).toEqual({});
      expect(result.maxIterations).toBe(10);
      expect(result.verbose).toBe(false);
    });

    it('should support different process types', () => {
      const processes = ['sequential', 'hierarchical', 'collaborative'] as const;
      
      processes.forEach(process => {
        const crew = {
          id: `crew-${process}`,
          name: `${process} Crew`,
          description: `Crew with ${process} process`,
          agents: ['agent1'],
          process,
          tasks: [
            {
              id: 'task1',
              description: 'Test task',
              agent: 'agent1'
            }
          ]
        };

        const result = CrewDefinitionSchema.parse(crew);
        expect(result.process).toBe(process);
      });
    });

    it('should validate shared context structure', () => {
      const crewWithContext = {
        id: 'context-crew',
        name: 'Context Crew',
        description: 'Crew with shared context',
        agents: ['agent1'],
        tasks: [
          {
            id: 'task1',
            description: 'Task with context',
            agent: 'agent1'
          }
        ],
        sharedContext: {
          environment: 'test',
          config: {
            retries: 3,
            timeout: 30000
          },
          data: ['item1', 'item2']
        }
      };

      const result = CrewDefinitionSchema.parse(crewWithContext);
      
      expect(result.sharedContext.environment).toBe('test');
      expect(result.sharedContext.config.retries).toBe(3);
      expect(result.sharedContext.data).toEqual(['item1', 'item2']);
    });

    it('should require at least one agent', () => {
      const crewWithoutAgents = {
        id: 'empty-crew',
        name: 'Empty Crew', 
        description: 'Crew without agents',
        agents: [], // Empty agents array should fail
        tasks: [
          {
            id: 'task1',
            description: 'Orphaned task',
            agent: 'agent1'
          }
        ]
      };

      expect(() => {
        CrewDefinitionSchema.parse(crewWithoutAgents);
      }).toThrow();
    });

    it('should require at least one task', () => {
      const crewWithoutTasks = {
        id: 'taskless-crew',
        name: 'Taskless Crew',
        description: 'Crew without tasks',
        agents: ['agent1'],
        tasks: [] // Empty tasks array should fail
      };

      expect(() => {
        CrewDefinitionSchema.parse(crewWithoutTasks);
      }).toThrow();
    });

    it('should reject invalid process type', () => {
      const invalidCrew = {
        id: 'invalid-crew',
        name: 'Invalid Crew',
        description: 'Crew with invalid process',
        agents: ['agent1'],
        process: 'invalid-process', // Invalid process type
        tasks: [
          {
            id: 'task1',
            description: 'Test task',
            agent: 'agent1'
          }
        ]
      };

      expect(() => {
        CrewDefinitionSchema.parse(invalidCrew);
      }).toThrow();
    });
  });

  describe('Complex Crew Scenarios', () => {
    it('should validate multi-task crew with dependencies', () => {
      const complexCrew = {
        id: 'complex-crew',
        name: 'Complex Multi-Task Crew',
        description: 'A crew with multiple interconnected tasks',
        agents: ['researcher', 'analyst', 'writer'],
        process: 'sequential',
        tasks: [
          {
            id: 'research',
            description: 'Conduct initial research',
            agent: 'researcher',
            expectedOutput: 'Research findings',
            tools: ['web-scraper'],
            outputKey: 'research_data'
          },
          {
            id: 'analyze',
            description: 'Analyze research findings',
            agent: 'analyst',
            expectedOutput: 'Analysis report',
            context: ['research'],
            tools: ['data-processor'],
            outputKey: 'analysis_report'
          },
          {
            id: 'write',
            description: 'Write final report',
            agent: 'writer',
            expectedOutput: 'Final report',
            context: ['research', 'analyze'],
            validateOutput: true,
            outputKey: 'final_report'
          }
        ],
        sharedContext: {
          project: 'Market Research',
          deadline: '2024-12-31',
          requirements: ['comprehensive', 'actionable']
        },
        maxIterations: 15,
        verbose: true
      };

      const result = CrewDefinitionSchema.parse(complexCrew);
      
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[1].context).toEqual(['research']);
      expect(result.tasks[2].context).toEqual(['research', 'analyze']);
      expect(result.tasks[2].validateOutput).toBe(true);
      expect(result.maxIterations).toBe(15);
      expect(result.verbose).toBe(true);
    });
  });
});