/**
 * Base interface for all tools
 */
export interface Tool {
  /**
   * Tool name
   */
  name: string;

  /**
   * Tool description
   */
  description: string;

  /**
   * Execute the tool
   */
  execute(parameters: any): Promise<any>;

  /**
   * Validate input parameters
   */
  validate(parameters: any): boolean;

  /**
   * Get tool schema
   */
  getSchema(): any;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;
    timestamp: Date;
  };
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * Tool registry
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all tool schemas
   */
  getAllSchemas(): any[] {
    return Array.from(this.tools.values()).map(tool => tool.getSchema());
  }
}

/**
 * Base tool implementation
 */
export abstract class BaseTool implements Tool {
  name: string;
  description: string;
  protected config: Record<string, any>;

  constructor(name: string, description: string, config: Record<string, any> = {}) {
    this.name = name;
    this.description = description;
    this.config = config;
  }

  abstract execute(parameters: any): Promise<any>;
  abstract validate(parameters: any): boolean;
  abstract getSchema(): any;

  /**
   * Validate required parameters
   */
  protected validateRequired(parameters: any, required: string[]): boolean {
    return required.every(field => parameters[field] !== undefined);
  }

  /**
   * Create tool result
   */
  protected createResult(success: boolean, data?: any, error?: string): ToolResult {
    return {
      success,
      data,
      error,
      metadata: {
        duration: 0,
        timestamp: new Date()
      }
    };
  }
}