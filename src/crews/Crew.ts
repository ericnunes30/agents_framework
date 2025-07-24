import { Agent } from '../agents/Agent.js';
import { CrewDefinition, TaskDefinition } from '../config/schemas.js';
import { StateManager } from '../state/StateManager.js';
import { CrewState, AgentState, TaskResult } from '../state/types.js';
import { EventEmitter } from 'events';

/**
 * Process execution context
 */
export interface ProcessContext {
  input: string;
  sharedContext: Record<string, any>;
  previousResults: Record<string, any>;
  currentTaskIndex: number;
}

/**
 * Process orchestrator interface
 */
export interface ProcessOrchestrator {
  execute(
    crew: Crew,
    input: string,
    context: ProcessContext
  ): Promise<Record<string, any>>;
}

/**
 * Crew orchestrator for multi-agent systems
 */
export class Crew extends EventEmitter {
  private definition: CrewDefinition;
  private agents: Map<string, Agent>;
  private stateManager: StateManager;
  private state: CrewState;

  constructor(
    definition: CrewDefinition,
    agents: Map<string, Agent>,
    stateManager: StateManager
  ) {
    super();
    this.definition = definition;
    this.agents = agents;
    this.stateManager = stateManager;
    
    this.state = {
      id: definition.id,
      name: definition.name,
      status: 'pending',
      agents: {},
      tasks: {},
      sharedContext: { ...definition.sharedContext },
      metrics: {
        totalAgents: definition.agents.length,
        completedAgents: 0,
        totalTasks: definition.tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        totalRuntime: 0,
        estimatedCost: 0
      }
    };

    this.initializeAgentStates();
  }

  /**
   * Initialize agent states in crew
   */
  private initializeAgentStates(): void {
    this.agents.forEach((agent, agentId) => {
      const agentState: AgentState = {
        id: agentId,
        name: agent.getDefinition().name,
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
      this.state.agents[agentId] = agentState;
    });
  }

  /**
   * Execute the crew with given input
   */
  async execute(input: string): Promise<Record<string, any>> {
    const startTime = Date.now();
    
    try {
      this.state.status = 'running';
      this.state.startTime = new Date();
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('crew_started', { crewId: this.definition.id, input });

      const context: ProcessContext = {
        input,
        sharedContext: this.state.sharedContext,
        previousResults: {},
        currentTaskIndex: 0
      };

      let results: Record<string, any>;

      switch (this.definition.process) {
        case 'sequential':
          results = await this.executeSequential(context);
          break;
        case 'hierarchical':
          results = await this.executeHierarchical(context);
          break;
        case 'collaborative':
          results = await this.executeCollaborative(context);
          break;
        default:
          throw new Error(`Unknown process type: ${this.definition.process}`);
      }

      this.state.status = 'completed';
      this.state.endTime = new Date();
      this.state.metrics.totalRuntime = Date.now() - startTime;
      
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('crew_completed', { 
        crewId: this.definition.id, 
        results,
        runtime: this.state.metrics.totalRuntime 
      });

      return results;
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = new Date();
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.metrics.totalRuntime = Date.now() - startTime;
      
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('crew_failed', { 
        crewId: this.definition.id, 
        error: this.state.error 
      });

      throw error;
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(context: ProcessContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (let i = 0; i < this.definition.tasks.length; i++) {
      const task = this.definition.tasks[i];
      context.currentTaskIndex = i;
      
      const result = await this.executeTask(task, context);
      results[task.id] = result;
      context.previousResults[task.id] = result;
      
      if (task.outputKey) {
        context.sharedContext[task.outputKey] = result;
      }
    }
    
    return results;
  }

  /**
   * Execute tasks hierarchically (manager-worker pattern)
   */
  private async executeHierarchical(context: ProcessContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    // First task is the manager
    const managerTask = this.definition.tasks[0];
    const managerAgent = this.agents.get(managerTask.agent);
    
    if (!managerAgent) {
      throw new Error(`Manager agent not found: ${managerTask.agent}`);
    }

    // Manager creates plan
    const planPrompt = this.buildPlanPrompt(context);
    const plan = await managerAgent.executeTask(planPrompt, context.sharedContext);
    
    context.sharedContext['execution_plan'] = plan;
    results['plan'] = plan;

    // Execute worker tasks based on plan
    const workerTasks = this.definition.tasks.slice(1);
    
    for (const task of workerTasks) {
      const result = await this.executeTask(task, context);
      results[task.id] = result;
      context.previousResults[task.id] = result;
    }

    // Final manager review
    const reviewPrompt = this.buildReviewPrompt(results, context);
    const finalResult = await managerAgent.executeTask(reviewPrompt, context.sharedContext);
    
    results['final_review'] = finalResult;
    
    return results;
  }

  /**
   * Execute tasks collaboratively (parallel with coordination)
   */
  private async executeCollaborative(context: ProcessContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const promises: Promise<void>[] = [];
    
    // Execute all tasks in parallel
    for (const task of this.definition.tasks) {
      const promise = this.executeTask(task, context).then(result => {
        results[task.id] = result;
        context.previousResults[task.id] = result;
        
        if (task.outputKey) {
          context.sharedContext[task.outputKey] = result;
        }
      });
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    // Synthesize results if there's a final task
    const finalTask = this.definition.tasks.find(t => t.context?.length === this.definition.tasks.length - 1);
    if (finalTask) {
      const synthesis = await this.executeTask(finalTask, context);
      results['synthesis'] = synthesis;
    }
    
    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: TaskDefinition, context: ProcessContext): Promise<any> {
    const agent = this.agents.get(task.agent);
    if (!agent) {
      throw new Error(`Agent not found for task: ${task.agent}`);
    }

    const startTime = Date.now();
    
    try {
      // Update agent state
      this.state.agents[task.agent].status = 'running';
      this.state.currentTask = task.id;
      
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('task_started', { 
        crewId: this.definition.id, 
        taskId: task.id, 
        agentId: task.agent 
      });

      // Build task context
      const taskContext = this.buildTaskContext(task, context);
      
      // Execute task
      const result = await agent.executeTask(task.description, taskContext);
      
      // Create task result
      const taskResult: TaskResult = {
        id: `${this.definition.id}-${task.id}-${Date.now()}`,
        agentId: task.agent,
        taskId: task.id,
        output: result,
        metadata: {
          tokensUsed: 0, // Will be updated from agent state
          model: agent.getDefinition().llm.model,
          provider: agent.getDefinition().llm.provider,
          duration: Date.now() - startTime,
          timestamp: new Date()
        },
        status: 'success'
      };

      // Update crew state
      this.state.tasks[task.id] = taskResult;
      this.state.agents[task.agent].status = 'completed';
      this.state.metrics.completedTasks++;
      
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('task_completed', { 
        crewId: this.definition.id, 
        taskId: task.id, 
        result 
      });

      return result;
    } catch (error) {
      // Update crew state with error
      this.state.agents[task.agent].status = 'failed';
      this.state.metrics.failedTasks++;
      this.state.error = error instanceof Error ? error.message : String(error);
      
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      this.emit('task_failed', { 
        crewId: this.definition.id, 
        taskId: task.id, 
        error: error instanceof Error ? error.message : String(error) 
      });

      throw error;
    }
  }

  /**
   * Build task context from previous results
   */
  private buildTaskContext(task: TaskDefinition, context: ProcessContext): Record<string, any> {
    const taskContext: Record<string, any> = {
      ...context.sharedContext,
      input: context.input,
      previousResults: {}
    };

    // Include context from specified previous tasks
    if (task.context && task.context.length > 0) {
      task.context.forEach(prevTaskId => {
        if (context.previousResults[prevTaskId]) {
          taskContext.previousResults[prevTaskId] = context.previousResults[prevTaskId];
        }
      });
    }

    return taskContext;
  }

  /**
   * Build plan prompt for hierarchical process
   */
  private buildPlanPrompt(context: ProcessContext): string {
    return `
You are the manager agent for this crew. Your task is to create a detailed execution plan.

Crew: ${this.definition.name}
Description: ${this.definition.description}
Input: ${context.input}

Available tasks:
${this.definition.tasks.map(t => `- ${t.id}: ${t.description}`).join('\n')}

Create a comprehensive execution plan that:
1. Analyzes the input requirements
2. Identifies dependencies between tasks
3. Assigns appropriate agents to each task
4. Defines expected outputs for each step
5. Includes quality checkpoints

Provide your plan in a structured format that can guide the execution process.
`;
  }

  /**
   * Build review prompt for hierarchical process
   */
  private buildReviewPrompt(results: Record<string, any>, context: ProcessContext): string {
    return `
You are the manager agent. Review the completed execution and provide a final comprehensive result.

Original input: ${context.input}

Task results:
${Object.entries(results).map(([key, value]) => `${key}: ${value}`).join('\n')}

Provide a final, cohesive response that synthesizes all the task results into a comprehensive answer to the original input.
`;
  }

  /**
   * Get crew definition
   */
  getDefinition(): CrewDefinition {
    return this.definition;
  }

  /**
   * Get current crew state
   */
  getState(): CrewState {
    return this.state;
  }

  /**
   * Get crew performance metrics
   */
  getMetrics() {
    return {
      ...this.state.metrics,
      successRate: this.state.metrics.totalTasks > 0 
        ? (this.state.metrics.completedTasks / this.state.metrics.totalTasks) * 100 
        : 0,
      currentStatus: this.state.status,
      estimatedCost: this.state.metrics.estimatedCost
    };
  }

  /**
   * Update shared context
   */
  async updateSharedContext(newContext: Record<string, any>): Promise<void> {
    this.state.sharedContext = { ...this.state.sharedContext, ...newContext };
    await this.stateManager.saveCrewState(this.definition.id, this.state);
  }

  /**
   * Reset crew state
   */
  async reset(): Promise<void> {
    this.state.status = 'pending';
    this.state.tasks = {};
    this.state.sharedContext = { ...this.definition.sharedContext };
    this.state.error = undefined;
    this.state.startTime = undefined;
    this.state.endTime = undefined;
    this.state.metrics.completedTasks = 0;
    this.state.metrics.failedTasks = 0;
    this.state.metrics.totalRuntime = 0;
    this.state.metrics.estimatedCost = 0;

    // Reset agent states
    Object.keys(this.state.agents).forEach(agentId => {
      this.state.agents[agentId].status = 'pending';
      this.state.agents[agentId].tasks = [];
    });

    await this.stateManager.saveCrewState(this.definition.id, this.state);
  }

  /**
   * Cancel current execution
   */
  async cancel(): Promise<void> {
    if (this.state.status === 'running') {
      this.state.status = 'cancelled';
      this.state.endTime = new Date();
      await this.stateManager.saveCrewState(this.definition.id, this.state);

      // Cancel all running agents
      for (const agent of this.agents.values()) {
        await agent.cancelCurrentTask();
      }
    }
  }
}