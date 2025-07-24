import { LLMClient } from '../llm/types.js';
import { StateManager } from '../state/StateManager.js';
import { AgentState, TaskResult } from '../state/types.js';
import { AgentDefinition } from '../config/schemas.js';
import { NativeToolManager } from '../tools/native/NativeToolManager.js';

/**
 * Base agent class for executing tasks with LLM integration
 */
export class Agent {
  private definition: AgentDefinition;
  private llmClient: LLMClient;
  private stateManager: StateManager;
  private nativeToolManager: NativeToolManager;
  private id: string;
  private state: AgentState;

  constructor(
    definition: AgentDefinition,
    llmClient: LLMClient,
    stateManager: StateManager,
    nativeToolManager?: NativeToolManager
  ) {
    this.definition = definition;
    this.llmClient = llmClient;
    this.stateManager = stateManager;
    this.nativeToolManager = nativeToolManager || new NativeToolManager();
    this.id = definition.id;
    
    this.state = {
      id: this.id,
      name: definition.name,
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
  }

  /**
   * Get agent definition
   */
  getDefinition(): AgentDefinition {
    return this.definition;
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Execute a task with the agent
   */
  async executeTask(task: string, context: Record<string, any> = {}): Promise<string> {
    const startTime = Date.now();
    
    this.state.status = 'running';
    this.state.currentTask = task;
    this.state.startTime = new Date();
    await this.stateManager.saveAgentState(this.id, this.state);

    try {
      const response = await this.llmClient.chat([
        { role: 'system' as const, content: this.buildSystemPrompt() },
        { role: 'user' as const, content: this.buildTaskPrompt(task, context) }
      ], this.definition.llm);

      const result = response.choices[0]?.message?.content || '';
      await this.updateTaskState('success', result, response, startTime, context);
      return result;

    } catch (error) {
      await this.updateTaskState('error', '', null, startTime, {}, error);
      throw error;
    }
  }

  /**
   * Execute multiple tasks sequentially
   */
  async executeTasks(tasks: string[], context: Record<string, any> = {}): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const result = await this.executeTask(tasks[i], context);
      results.push(result);
      context[`task_${i}_result`] = result;
    }
    
    return results;
  }

  /**
   * Update agent state after task execution
   */
  private async updateTaskState(
    status: 'success' | 'error',
    result: string,
    response: any,
    startTime: number,
    context: Record<string, any>,
    error?: any
  ): Promise<void> {
    const duration = Date.now() - startTime;
    const tokens = response?.usage?.total_tokens || 0;
    
    const taskResult: TaskResult = {
      id: `${this.id}-${Date.now()}`,
      agentId: this.id,
      taskId: this.state.currentTask || '',
      output: result,
      metadata: {
        tokensUsed: tokens,
        model: response?.model || this.definition.llm.model,
        provider: this.definition.llm.provider,
        duration,
        timestamp: new Date()
      },
      status,
      error: error ? (error instanceof Error ? error.message : String(error)) : undefined
    };

    this.state.tasks.push(taskResult);
    this.state.tokensUsed += tokens;
    this.state.metrics.totalTasks++;
    this.state.metrics[status === 'success' ? 'successfulTasks' : 'failedTasks']++;
    this.state.metrics.totalRuntime += duration;
    this.state.metrics.averageTaskTime = this.state.metrics.totalRuntime / this.state.metrics.totalTasks;
    this.state.context = { ...this.state.context, ...context };

    await this.stateManager.saveTaskResult(taskResult.id, taskResult);

    this.state.status = status === 'success' ? 'completed' : 'failed';
    this.state.endTime = new Date();
    this.state.currentTask = undefined;
    if (error) this.state.error = taskResult.error;

    await this.stateManager.saveAgentState(this.id, this.state);
  }

  /**
   * Build system prompt based on agent definition
   */
  private buildSystemPrompt(): string {
    const parts = [
      `You are ${this.definition.name}, a ${this.definition.role}.`,
      `Your goal is: ${this.definition.goal}`,
      `Your background: ${this.definition.backstory}`,
      `
Instructions:
- Be thorough and detailed in your responses
- Provide actionable insights and recommendations
- Use clear, professional language
- Break down complex tasks into understandable steps
- Always provide sources or reasoning for your conclusions
`
    ];

    if (this.definition.tools?.length > 0) {
      parts.push(`\nAvailable tools: ${this.definition.tools.join(', ')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build task prompt with context
   */
  private buildTaskPrompt(task: string, context: Record<string, any>): string {
    let prompt = `Task: ${task}\n\n`;
    
    if (Object.keys(context).length > 0) {
      prompt += 'Context:\n';
      Object.entries(context).forEach(([key, value]) => {
        prompt += `${key}: ${value}\n`;
      });
      prompt += '\n';
    }

    prompt += `
Please provide a comprehensive response that addresses the task requirements.
Be specific, provide examples where relevant, and ensure your response is actionable.
`;

    return prompt;
  }

  /**
   * Reset agent state
   */
  async reset(): Promise<void> {
    this.state = {
      id: this.id,
      name: this.definition.name,
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

    await this.stateManager.saveAgentState(this.id, this.state);
  }

  /**
   * Get agent performance metrics
   */
  getMetrics() {
    return {
      ...this.state.metrics,
      totalTokens: this.state.tokensUsed,
      successRate: this.state.metrics.totalTasks > 0 
        ? (this.state.metrics.successfulTasks / this.state.metrics.totalTasks) * 100 
        : 0,
      averageResponseTime: this.state.metrics.averageTaskTime,
      currentStatus: this.state.status
    };
  }

  /**
   * Update agent context
   */
  async updateContext(newContext: Record<string, any>): Promise<void> {
    this.state.context = { ...this.state.context, ...newContext };
    await this.stateManager.saveAgentState(this.id, this.state);
  }

  /**
   * Get task history
   */
  getTaskHistory(): TaskResult[] {
    return [...this.state.tasks];
  }

  /**
   * Cancel current task
   */
  async cancelCurrentTask(): Promise<void> {
    if (this.state.status === 'running') {
      this.state.status = 'cancelled';
      this.state.endTime = new Date();
      this.state.currentTask = undefined;
      await this.stateManager.saveAgentState(this.id, this.state);
    }
  }

  /**
   * Execute a native tool
   */
  async executeNativeTool(toolName: string, parameters: any): Promise<any> {
    // Check if tool is available to this agent
    const availableToolNames = this.definition.tools?.map(tool => 
      typeof tool === 'string' ? tool : tool.name
    ) || [];

    if (!availableToolNames.includes(toolName)) {
      throw new Error(`Tool ${toolName} is not available to agent ${this.id}`);
    }

    return this.nativeToolManager.executeTool(toolName, parameters);
  }

  /**
   * Get available native tools for this agent
   */
  getAvailableNativeTools(): string[] {
    const configuredTools = this.definition.tools?.map(tool => 
      typeof tool === 'string' ? tool : tool.name
    ) || [];

    return configuredTools.filter(toolName => 
      this.nativeToolManager.hasTool(toolName)
    );
  }

  /**
   * Get tool information for available tools
   */
  getToolsInfo(): Array<{ name: string; description: string; schema: any }> {
    const availableTools = this.getAvailableNativeTools();
    return availableTools.map(toolName => 
      this.nativeToolManager.getToolInfo(toolName)
    ).filter(Boolean) as Array<{ name: string; description: string; schema: any }>;
  }

  /**
   * Check if agent has access to a specific tool
   */
  hasNativeTool(toolName: string): boolean {
    return this.getAvailableNativeTools().includes(toolName);
  }
}