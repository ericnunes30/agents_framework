import { WebScraperTool } from './WebScraperTool.js';
import { RedisTool } from './RedisTool.js';
import { BaseTool, Tool } from '../BaseTool.js';

/**
 * Manager for native (built-in) tools
 */
export class NativeToolManager {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // Web scraping tool (Playwright-based)
    this.register(new WebScraperTool());
    
    // Redis operations tool
    this.register(new RedisTool());
    
    console.log(`Registered ${this.tools.size} native tools`);
  }

  /**
   * Register a native tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available native tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, parameters: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Native tool not found: ${name}`);
    }

    if (!tool.validate(parameters)) {
      throw new Error(`Invalid parameters for tool: ${name}`);
    }

    return tool.execute(parameters);
  }

  /**
   * Get tool schemas for documentation/validation
   */
  getToolSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};
    
    this.tools.forEach((tool, name) => {
      schemas[name] = tool.getSchema();
    });

    return schemas;
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool information
   */
  getToolInfo(name: string): { name: string; description: string; schema: any } | null {
    const tool = this.tools.get(name);
    return tool ? {
      name: tool.name,
      description: tool.description,
      schema: tool.getSchema()
    } : null;
  }

  /**
   * Health check for all tools
   */
  async healthCheck(): Promise<Record<string, { status: string; error?: string }>> {
    const results: Record<string, { status: string; error?: string }> = {};

    for (const [name, tool] of this.tools) {
      try {
        const isValid = typeof tool.execute === 'function' && typeof tool.validate === 'function';
        results[name] = isValid 
          ? { status: 'healthy' }
          : { status: 'unhealthy', error: 'Missing required methods' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[name] = { status: 'unhealthy', error: message };
      }
    }

    return results;
  }
}