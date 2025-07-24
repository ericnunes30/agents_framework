import { readFileSync, existsSync, readdirSync } from 'fs';
import { load } from 'js-yaml';
import { join, resolve } from 'path';
import { 
  AgentDefinitionSchema, 
  CrewDefinitionSchema, 
  AgentDefinition, 
  CrewDefinition 
} from './schemas.js';

/**
 * Configuration loader for YAML-based agent and crew definitions
 */
export class ConfigLoader {
  private static readonly CONFIGS_DIR = resolve(process.cwd(), 'configs');
  private static readonly AGENTS_DIR = join(this.CONFIGS_DIR, 'agents');
  private static readonly CREWS_DIR = join(this.CONFIGS_DIR, 'crews');

  /**
   * Load and validate an agent configuration from YAML file
   * @param filePath - Path to the YAML file (relative to configs/agents/ or absolute)
   * @returns Validated agent definition
   * @throws Error if file not found or validation fails
   */
  static loadAgentConfig(filePath: string): AgentDefinition {
    const fullPath = this.resolveAgentPath(filePath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Agent configuration file not found: ${fullPath}`);
    }

    try {
      const content = readFileSync(fullPath, 'utf8');
      const config = load(content);
      return AgentDefinitionSchema.parse(config);
    } catch (error) {
      throw new Error(`Failed to load agent config from ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load and validate a crew configuration from YAML file
   * @param filePath - Path to the YAML file (relative to configs/crews/ or absolute)
   * @returns Validated crew definition
   * @throws Error if file not found or validation fails
   */
  static loadCrewConfig(filePath: string): CrewDefinition {
    const fullPath = this.resolveCrewPath(filePath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Crew configuration file not found: ${fullPath}`);
    }

    try {
      const content = readFileSync(fullPath, 'utf8');
      const config = load(content);
      return CrewDefinitionSchema.parse(config);
    } catch (error) {
      throw new Error(`Failed to load crew config from ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load all agent configurations from the agents directory
   * @returns Array of validated agent definitions
   */
  static loadAllAgents(): AgentDefinition[] {
    const agentsDir = this.AGENTS_DIR;
    
    if (!existsSync(agentsDir)) {
      return [];
    }

    const files = readdirSync(agentsDir)
      .filter((file: string) => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map((file: string) => join('agents', file));

    return files.map((file: string) => this.loadAgentConfig(file));
  }

  /**
   * Load all crew configurations from the crews directory
   * @returns Array of validated crew definitions
   */
  static loadAllCrews(): CrewDefinition[] {
    const crewsDir = this.CREWS_DIR;
    
    if (!existsSync(crewsDir)) {
      return [];
    }

    const files = readdirSync(crewsDir)
      .filter((file: string) => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map((file: string) => join('crews', file));

    return files.map((file: string) => this.loadCrewConfig(file));
  }

  /**
   * Resolve agent configuration file path
   * @param filePath - Relative or absolute path
   * @returns Absolute path to the configuration file
   */
  private static resolveAgentPath(filePath: string): string {
    if (filePath.startsWith('/') || filePath.includes(':\\')) {
      return filePath;
    }
    
    if (!filePath.startsWith('agents/')) {
      filePath = join('agents', filePath);
    }
    
    return join(this.CONFIGS_DIR, filePath);
  }

  /**
   * Resolve crew configuration file path
   * @param filePath - Relative or absolute path
   * @returns Absolute path to the configuration file
   */
  private static resolveCrewPath(filePath: string): string {
    if (filePath.startsWith('/') || filePath.includes(':\\')) {
      return filePath;
    }
    
    if (!filePath.startsWith('crews/')) {
      filePath = join('crews', filePath);
    }
    
    return join(this.CONFIGS_DIR, filePath);
  }

  /**
   * Validate a configuration file without loading it
   * @param filePath - Path to the configuration file
   * @param type - Type of configuration ('agent' or 'crew')
   * @returns Validation result
   */
  static validateConfig(filePath: string, type: 'agent' | 'crew'): { valid: boolean; errors: string[] } {
    try {
      if (type === 'agent') {
        this.loadAgentConfig(filePath);
      } else {
        this.loadCrewConfig(filePath);
      }
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
    }
  }

  /**
   * Create a template configuration file
   * @param type - Type of template ('agent' or 'crew')
   * @param name - Name for the template file
   * @returns Template content
   */
  static createTemplate(type: 'agent' | 'crew', name: string): string {
    if (type === 'agent') {
      return `id: ${name.toLowerCase().replace(/\s+/g, '-')}
name: ${name}
role: Your role description
goal: What this agent aims to accomplish
backstory: |
  A detailed backstory that gives context to the agent's
  personality, expertise, and approach to tasks.
tools:
  - web-scraper
  - redis-tool
llm:
  provider: openai
  model: gpt-4.1-mini
  temperature: 0.7
  maxTokens: 2000
maxIterations: 5
timeout: 30000
memory:
  enabled: true
  maxContextLength: 4000
`;
    } else {
      return `id: ${name.toLowerCase().replace(/\s+/g, '-')}
name: ${name}
description: |
  A comprehensive description of what this crew does
  and how the agents work together.
agents:
  - researcher
  - analyst
  - writer
process: sequential
tasks:
  - id: research
    description: Research the given topic thoroughly
    agent: researcher
    expectedOutput: Detailed research findings
    outputKey: research_data
    
  - id: analyze
    description: Analyze the research findings
    agent: analyst
    expectedOutput: Analysis report
    context: [research]
    outputKey: analysis_report
    
  - id: write
    description: Write final report based on analysis
    agent: writer
    expectedOutput: Final comprehensive report
    context: [research, analyze]
    outputKey: final_report
sharedContext: {}
maxIterations: 10
verbose: true
`;
    }
  }
}