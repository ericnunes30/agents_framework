import { Agent } from './Agent.js';
import { AgentDefinition } from '../config/schemas.js';
import { LLMClient } from '../llm/types.js';
import { StateManager } from '../state/StateManager.js';
import { ConfigLoader } from '../config/loader.js';
import { OpenAIClient } from '../llm/OpenAIClient.js';
import { OpenRouterClient } from '../llm/OpenRouterClient.js';
import { NativeToolManager } from '../tools/native/NativeToolManager.js';

/**
 * Agent runner for creating and managing agent instances
 */
export class AgentRunner {
  private stateManager: StateManager;
  private nativeToolManager: NativeToolManager;
  private agents: Map<string, Agent> = new Map();
  private llmClients: Map<string, LLMClient> = new Map();

  constructor(stateManager: StateManager, nativeToolManager?: NativeToolManager) {
    this.stateManager = stateManager;
    this.nativeToolManager = nativeToolManager || new NativeToolManager();
  }

  /**
   * Create an LLM client based on provider
   */
  private createLLMClient(provider: string, config: any): LLMClient {
    const cacheKey = `${provider}-${config.model}`;
    
    if (this.llmClients.has(cacheKey)) {
      return this.llmClients.get(cacheKey)!;
    }

    let client: LLMClient;
    
    switch (provider) {
      case 'openai':
        client = new OpenAIClient(config.apiKey);
        break;
      case 'openrouter':
        client = new OpenRouterClient(config.apiKey);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    this.llmClients.set(cacheKey, client);
    return client;
  }

  /**
   * Create and register an agent from definition
   */
  async createAgent(agentDefinition: AgentDefinition): Promise<Agent> {
    const llmClient = this.createLLMClient(
      agentDefinition.llm.provider,
      agentDefinition.llm
    );

    const agent = new Agent(agentDefinition, llmClient, this.stateManager, this.nativeToolManager);
    this.agents.set(agentDefinition.id, agent);

    // Save initial state
    await this.stateManager.saveAgentState(agentDefinition.id, agent.getState());

    return agent;
  }

  /**
   * Create agent from configuration file
   */
  async createAgentFromConfig(configPath: string): Promise<Agent> {
    const agentDefinition = ConfigLoader.loadAgentConfig(configPath);
    return this.createAgent(agentDefinition);
  }

  /**
   * Get an existing agent
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all registered agents
   */
  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Execute a task with a specific agent
   */
  async executeTask(agentId: string, task: string, context?: Record<string, any>): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.executeTask(task, context);
  }

  /**
   * Execute multiple tasks with a specific agent
   */
  async executeTasks(agentId: string, tasks: string[], context?: Record<string, any>): Promise<string[]> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.executeTasks(tasks, context);
  }

  /**
   * Get agent state
   */
  async getAgentState(agentId: string) {
    return this.stateManager.getAgentState(agentId);
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.getMetrics();
  }

  /**
   * Reset agent state
   */
  async resetAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    await agent.reset();
  }

  /**
   * Remove an agent
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.reset();
      this.agents.delete(agentId);
    }
  }

  /**
   * Get all agents and their states
   */
  async getAllAgentStates() {
    const agentConfigs = ConfigLoader.loadAllAgents();
    const states = [];

    for (const config of agentConfigs) {
      const state = await this.getAgentState(config.id);
      states.push({
        definition: config,
        state: state
      });
    }

    return states;
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<any[]> {
    const results = [];

    for (const [agentId, agent] of this.agents) {
      try {
        const metrics = agent.getMetrics();
        const state = await this.getAgentState(agentId);
        
        results.push({
          agentId,
          status: 'healthy',
          metrics,
          state
        });
      } catch (error) {
        results.push({
          agentId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = [];
    
    for (const [agentId, agent] of this.agents) {
      shutdownPromises.push(agent.cancelCurrentTask());
    }

    await Promise.all(shutdownPromises);
    this.agents.clear();
  }
}