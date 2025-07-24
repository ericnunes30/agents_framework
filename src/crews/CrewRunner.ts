import { Crew } from './Crew.js';
import { CrewDefinition } from '../config/schemas.js';
import { Agent } from '../agents/Agent.js';
import { StateManager } from '../state/StateManager.js';
import { ConfigLoader } from '../config/loader.js';
import { AgentRunner } from '../agents/AgentRunner.js';

/**
 * Crew runner for creating and managing crew instances
 */
export class CrewRunner {
  private stateManager: StateManager;
  private agentRunner: AgentRunner;
  private crews: Map<string, Crew> = new Map();

  constructor(stateManager: StateManager, agentRunner: AgentRunner) {
    this.stateManager = stateManager;
    this.agentRunner = agentRunner;
  }

  /**
   * Create and register a crew
   */
  async createCrew(crewDefinition: CrewDefinition): Promise<Crew> {
    // Ensure all required agents exist
    const agents = new Map<string, Agent>();
    
    for (const agentId of crewDefinition.agents) {
      let agent = this.agentRunner.getAgent(agentId);
      if (!agent) {
        // Try to load from config
        try {
          agent = await this.agentRunner.createAgentFromConfig(`agents/${agentId}.yaml`);
        } catch (error) {
          throw new Error(`Failed to load agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      agents.set(agentId, agent);
    }

    const crew = new Crew(crewDefinition, agents, this.stateManager);
    this.crews.set(crewDefinition.id, crew);

    // Save initial state
    await this.stateManager.saveCrewState(crewDefinition.id, crew.getState());

    return crew;
  }

  /**
   * Create crew from configuration file
   */
  async createCrewFromConfig(configPath: string): Promise<Crew> {
    const crewDefinition = ConfigLoader.loadCrewConfig(configPath);
    return this.createCrew(crewDefinition);
  }

  /**
   * Get an existing crew
   */
  getCrew(crewId: string): Crew | undefined {
    return this.crews.get(crewId);
  }

  /**
   * List all registered crews
   */
  listCrews(): string[] {
    return Array.from(this.crews.keys());
  }

  /**
   * Execute a crew with input
   */
  async executeCrew(crewId: string, input: string): Promise<Record<string, any>> {
    const crew = this.crews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    return crew.execute(input);
  }

  /**
   * Execute crew with custom context
   */
  async executeCrewWithContext(
    crewId: string, 
    input: string, 
    context: Record<string, any>
  ): Promise<Record<string, any>> {
    const crew = this.crews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    await crew.updateSharedContext(context);
    return crew.execute(input);
  }

  /**
   * Get crew state
   */
  async getCrewState(crewId: string) {
    return this.stateManager.getCrewState(crewId);
  }

  /**
   * Get crew metrics
   */
  getCrewMetrics(crewId: string) {
    const crew = this.crews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    return crew.getMetrics();
  }

  /**
   * Reset crew state
   */
  async resetCrew(crewId: string): Promise<void> {
    const crew = this.crews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    await crew.reset();
  }

  /**
   * Remove a crew
   */
  async removeCrew(crewId: string): Promise<void> {
    const crew = this.crews.get(crewId);
    if (crew) {
      await crew.cancel();
      this.crews.delete(crewId);
    }
  }

  /**
   * Get all crews and their states
   */
  async getAllCrewStates() {
    const crewConfigs = ConfigLoader.loadAllCrews();
    const states = [];

    for (const config of crewConfigs) {
      const state = await this.getCrewState(config.id);
      states.push({
        definition: config,
        state: state
      });
    }

    return states;
  }

  /**
   * Validate crew configuration
   */
  validateCrew(crewDefinition: CrewDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if all required agents are available
    for (const agentId of crewDefinition.agents) {
      if (!this.agentRunner.getAgent(agentId)) {
        try {
          // Try to load agent config to validate it exists
          ConfigLoader.loadAgentConfig(`agents/${agentId}.yaml`);
        } catch (error) {
          errors.push(`Agent ${agentId} not found: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Check if task agents are valid
    for (const task of crewDefinition.tasks) {
      if (!crewDefinition.agents.includes(task.agent)) {
        errors.push(`Task ${task.id} references agent ${task.agent} which is not in the crew`);
      }
    }

    // Check context dependencies
    for (const task of crewDefinition.tasks) {
      if (task.context) {
        for (const depTaskId of task.context) {
          const depTask = crewDefinition.tasks.find(t => t.id === depTaskId);
          if (!depTask) {
            errors.push(`Task ${task.id} references non-existent context task: ${depTaskId}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Health check for all crews
   */
  async healthCheck(): Promise<any[]> {
    const results = [];

    for (const [crewId, crew] of this.crews) {
      try {
        const metrics = crew.getMetrics();
        const state = await this.getCrewState(crewId);
        
        results.push({
          crewId,
          status: 'healthy',
          metrics,
          state
        });
      } catch (error) {
        results.push({
          crewId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Get crew execution logs
   */
  async getCrewLogs(crewId: string, limit: number = 50): Promise<any[]> {
    const state = await this.getCrewState(crewId);
    if (!state) {
      return [];
    }

    const logs = Object.values(state.tasks)
      .sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime())
      .slice(0, limit);

    return logs;
  }

  /**
   * Get system overview
   */
  async getSystemOverview() {
    const [crewStates, agentStates, systemStats] = await Promise.all([
      this.getAllCrewStates(),
      this.agentRunner.getAllAgentStates(),
      this.stateManager.getSystemStats()
    ]);

    return {
      crews: crewStates,
      agents: agentStates,
      system: systemStats,
      timestamp: new Date()
    };
  }

  /**
   * Shutdown all crews
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = [];
    
    for (const [crewId, crew] of this.crews) {
      shutdownPromises.push(crew.cancel());
    }

    await Promise.all(shutdownPromises);
    this.crews.clear();
  }
}