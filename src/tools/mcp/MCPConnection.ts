import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { EventEmitter } from 'events';
import { 
  MCPServerConfig, 
  MCPConnectionStatus, 
  MCPTool, 
  MCPToolResult,
  MCPConnectionInfo 
} from './types.js';

/**
 * Manages a single MCP server connection
 */
export class MCPConnection extends EventEmitter {
  private config: MCPServerConfig;
  private client?: Client;
  private transport?: StdioClientTransport;
  private status: MCPConnectionStatus = 'disconnected';
  private tools: MCPTool[] = [];
  private lastError?: string;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }

    try {
      this.status = 'connecting';
      this.emit('statusChange', this.status);

      // Create transport with the specified command and args
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env
      });

      // Create client
      this.client = new Client({
        name: `agent-framework-client`,
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      });

      // Connect
      await this.client.connect(this.transport);
      
      this.status = 'connected';
      this.lastError = undefined;
      this.emit('statusChange', this.status);
      this.emit('connected');

      // Discover available tools
      await this.discoverTools();

      console.log(`Connected to MCP server: ${this.config.name}`);

    } catch (error) {
      this.status = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
      this.emit('statusChange', this.status);
      this.emit('error', error);
      
      // Schedule reconnection
      this.scheduleReconnect();
      
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.client && this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn('Error closing MCP transport:', error);
      }
    }

    this.status = 'disconnected';
    this.client = undefined;
    this.transport = undefined;
    this.tools = [];
    
    this.emit('statusChange', this.status);
    this.emit('disconnected');
  }

  /**
   * Discover available tools from the server
   */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.listTools();
      this.tools = response.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any
      }));

      this.emit('toolsDiscovered', this.tools);
      console.log(`Discovered ${this.tools.length} tools from ${this.config.name}`);
    } catch (error) {
      console.error(`Failed to discover tools from ${this.config.name}:`, error);
      this.tools = [];
    }
  }

  /**
   * Execute a tool on the remote server
   */
  async executeTool(toolName: string, parameters: any): Promise<MCPToolResult> {
    if (!this.client) {
      throw new Error(`MCP client not connected to ${this.config.name}`);
    }

    if (this.status !== 'connected') {
      throw new Error(`MCP server ${this.config.name} is not connected (status: ${this.status})`);
    }

    // Check if tool exists
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${this.config.name}`);
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });

      return {
        content: Array.isArray(result.content) ? result.content : [],
        isError: Boolean(result.isError)
      };
    } catch (error) {
      throw new Error(`Failed to execute tool ${toolName} on ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): MCPConnectionInfo {
    return {
      name: this.config.name,
      status: this.status,
      config: this.config,
      tools: [...this.tools],
      lastError: this.lastError
    };
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Get connection status
   */
  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  /**
   * Check if tool is available
   */
  hasTool(toolName: string): boolean {
    return this.tools.some(tool => tool.name === toolName);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(delay: number = 5000): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      try {
        await this.connect();
      } catch (error) {
        console.warn(`Reconnection to ${this.config.name} failed:`, error);
        // Will schedule another reconnect attempt
      }
    }, delay);
  }

  /**
   * Refresh tools list
   */
  async refreshTools(): Promise<void> {
    if (this.status === 'connected') {
      await this.discoverTools();
    }
  }
}