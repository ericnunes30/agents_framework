/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

/**
 * MCP Connection status
 */
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP Tool definition from external server
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tool execution result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP Connection information
 */
export interface MCPConnectionInfo {
  name: string;
  status: MCPConnectionStatus;
  config: MCPServerConfig;
  tools: MCPTool[];
  lastConnected?: Date;
  lastError?: string;
}

/**
 * MCP Client configuration
 */
export interface MCPClientConfig {
  connectionTimeout: number;
  requestTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * MCP Server capabilities
 */
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
}