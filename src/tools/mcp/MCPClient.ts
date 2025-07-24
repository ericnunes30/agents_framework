import { EventEmitter } from 'events';
import { MCPConnection } from './MCPConnection.js';
import { 
  MCPServerConfig, 
  MCPClientConfig, 
  MCPTool, 
  MCPToolResult,
  MCPConnectionInfo 
} from './types.js';

/**
 * MCP Client for consuming external MCP servers
 */
export class MCPClient extends EventEmitter {
  private connections: Map<string, MCPConnection> = new Map();
  private config: MCPClientConfig;

  constructor(config: Partial<MCPClientConfig> = {}) {
    super();
    
    this.config = {
      connectionTimeout: 10000,
      requestTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Connect to an external MCP server
   */
  async connectToServer(serverConfig: MCPServerConfig): Promise<void> {
    if (this.connections.has(serverConfig.name)) {
      throw new Error(`MCP server ${serverConfig.name} is already connected`);
    }

    const connection = new MCPConnection(serverConfig);
    
    // Setup event handlers
    connection.on('connected', () => {
      this.emit('serverConnected', serverConfig.name);
    });

    connection.on('disconnected', () => {
      this.emit('serverDisconnected', serverConfig.name);
    });

    connection.on('error', (error) => {
      this.emit('serverError', serverConfig.name, error);
    });

    connection.on('toolsDiscovered', (tools) => {
      this.emit('toolsDiscovered', serverConfig.name, tools);
    });

    this.connections.set(serverConfig.name, connection);

    try {
      await connection.connect();
      console.log(`Successfully connected to MCP server: ${serverConfig.name}`);
    } catch (error) {
      this.connections.delete(serverConfig.name);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectFromServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    await connection.disconnect();
    this.connections.delete(serverName);
    console.log(`Disconnected from MCP server: ${serverName}`);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(
      serverName => this.disconnectFromServer(serverName)
    );
    
    await Promise.all(disconnectPromises);
  }

  /**
   * Execute a tool on a specific MCP server
   */
  async executeTool(serverName: string, toolName: string, parameters: any): Promise<MCPToolResult> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    return connection.executeTool(toolName, parameters);
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Array<MCPTool & { serverName: string }> {
    const allTools: Array<MCPTool & { serverName: string }> = [];
    
    for (const [serverName, connection] of this.connections) {
      const tools = connection.getTools();
      tools.forEach(tool => {
        allTools.push({
          ...tool,
          serverName
        });
      });
    }
    
    return allTools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): MCPTool[] {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }
    
    return connection.getTools();
  }

  /**
   * Check if a server has a specific tool
   */
  hasServerTool(serverName: string, toolName: string): boolean {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return false;
    }
    
    return connection.hasTool(toolName);
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName: string): string | null {
    for (const [serverName, connection] of this.connections) {
      if (connection.hasTool(toolName)) {
        return serverName;
      }
    }
    return null;
  }

  /**
   * Execute a tool by name (automatically find the server)
   */
  async executeToolByName(toolName: string, parameters: any): Promise<MCPToolResult> {
    const serverName = this.findToolServer(toolName);
    if (!serverName) {
      throw new Error(`Tool ${toolName} not found on any connected MCP server`);
    }
    
    return this.executeTool(serverName, toolName, parameters);
  }

  /**
   * Get connection information for all servers
   */
  getConnectionsInfo(): MCPConnectionInfo[] {
    return Array.from(this.connections.values()).map(
      connection => connection.getConnectionInfo()
    );
  }

  /**
   * Get connection information for a specific server
   */
  getServerInfo(serverName: string): MCPConnectionInfo | null {
    const connection = this.connections.get(serverName);
    return connection ? connection.getConnectionInfo() : null;
  }

  /**
   * List connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection ? connection.getStatus() === 'connected' : false;
  }

  /**
   * Refresh tools for all servers
   */
  async refreshAllTools(): Promise<void> {
    const refreshPromises = Array.from(this.connections.values()).map(
      connection => connection.refreshTools()
    );
    
    await Promise.all(refreshPromises);
  }

  /**
   * Refresh tools for a specific server
   */
  async refreshServerTools(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }
    
    await connection.refreshTools();
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<Record<string, { status: string; toolCount: number; error?: string }>> {
    const results: Record<string, { status: string; toolCount: number; error?: string }> = {};
    
    for (const [serverName, connection] of this.connections) {
      const info = connection.getConnectionInfo();
      results[serverName] = {
        status: info.status,
        toolCount: info.tools.length,
        error: info.lastError
      };
    }
    
    return results;
  }

  /**
   * Configure external MCP servers from environment variable
   */
  async configureFromEnvironment(): Promise<void> {
    const externalMCPs = process.env.MCP_EXTERNAL_SERVERS;
    if (!externalMCPs) {
      console.log('No external MCP servers configured in MCP_EXTERNAL_SERVERS');
      return;
    }

    try {
      const servers: MCPServerConfig[] = JSON.parse(externalMCPs);
      
      for (const serverConfig of servers) {
        try {
          await this.connectToServer(serverConfig);
          console.log(`Configured MCP server from environment: ${serverConfig.name}`);
        } catch (error) {
          console.error(`Failed to configure MCP server ${serverConfig.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to parse MCP_EXTERNAL_SERVERS:', error);
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolStats(): Record<string, { server: string; calls: number; lastUsed?: Date }> {
    // TODO: Implement tool usage tracking
    return {};
  }
}