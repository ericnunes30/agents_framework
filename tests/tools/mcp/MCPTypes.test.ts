import { describe, it, expect } from '@jest/globals';
import type { 
  MCPServerConfig, 
  MCPConnectionStatus, 
  MCPTool, 
  MCPToolResult, 
  MCPConnectionInfo, 
  MCPClientConfig,
  MCPServerCapabilities 
} from '../../../src/tools/mcp/types.js';

describe('MCP Types', () => {
  describe('MCPServerConfig', () => {
    it('should define valid server configuration', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'test' },
        cwd: '/path/to/server',
        timeout: 30000
      };

      expect(config.name).toBe('test-server');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
      expect(config.env?.NODE_ENV).toBe('test');
      expect(config.cwd).toBe('/path/to/server');
      expect(config.timeout).toBe(30000);
    });

    it('should support minimal server configuration', () => {
      const minimalConfig: MCPServerConfig = {
        name: 'minimal-server',
        command: 'python',
        args: ['-m', 'mcp_server']
      };

      expect(minimalConfig.name).toBe('minimal-server');
      expect(minimalConfig.command).toBe('python');
      expect(minimalConfig.args).toEqual(['-m', 'mcp_server']);
      expect(minimalConfig.env).toBeUndefined();
      expect(minimalConfig.cwd).toBeUndefined();
      expect(minimalConfig.timeout).toBeUndefined();
    });
  });

  describe('MCPConnectionStatus', () => {
    it('should support all connection states', () => {
      const statuses: MCPConnectionStatus[] = ['disconnected', 'connecting', 'connected', 'error'];
      
      statuses.forEach(status => {
        const testStatus: MCPConnectionStatus = status;
        expect(['disconnected', 'connecting', 'connected', 'error']).toContain(testStatus);
      });
    });
  });

  describe('MCPTool', () => {
    it('should define tool with input schema', () => {
      const tool: MCPTool = {
        name: 'web-scraper',
        description: 'Scrapes web pages for content',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape'
            },
            selector: {
              type: 'string',
              description: 'CSS selector for content'
            }
          },
          required: ['url']
        }
      };

      expect(tool.name).toBe('web-scraper');
      expect(tool.description).toBe('Scrapes web pages for content');
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties?.url?.type).toBe('string');
      expect(tool.inputSchema.required).toEqual(['url']);
    });

    it('should support simple tool definition', () => {
      const simpleTool: MCPTool = {
        name: 'simple-tool',
        description: 'A simple tool',
        inputSchema: {
          type: 'object'
        }
      };

      expect(simpleTool.name).toBe('simple-tool');
      expect(simpleTool.inputSchema.type).toBe('object');
      expect(simpleTool.inputSchema.properties).toBeUndefined();
      expect(simpleTool.inputSchema.required).toBeUndefined();
    });
  });

  describe('MCPToolResult', () => {
    it('should support text content result', () => {
      const textResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: 'Tool execution result'
          }
        ],
        isError: false
      };

      expect(textResult.content).toHaveLength(1);
      expect(textResult.content[0].type).toBe('text');
      expect(textResult.content[0].text).toBe('Tool execution result');
      expect(textResult.isError).toBe(false);
    });

    it('should support image content result', () => {
      const imageResult: MCPToolResult = {
        content: [
          {
            type: 'image',
            data: 'base64-encoded-image-data',
            mimeType: 'image/png'
          }
        ]
      };

      expect(imageResult.content[0].type).toBe('image');
      expect(imageResult.content[0].data).toBe('base64-encoded-image-data');
      expect(imageResult.content[0].mimeType).toBe('image/png');
      expect(imageResult.isError).toBeUndefined();
    });

    it('should support resource content result', () => {
      const resourceResult: MCPToolResult = {
        content: [
          {
            type: 'resource',
            data: 'resource-data',
            mimeType: 'application/json'
          }
        ]
      };

      expect(resourceResult.content[0].type).toBe('resource');
      expect(resourceResult.content[0].data).toBe('resource-data');
      expect(resourceResult.content[0].mimeType).toBe('application/json');
    });

    it('should support error result', () => {
      const errorResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: 'Tool execution failed'
          }
        ],
        isError: true
      };

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toBe('Tool execution failed');
    });

    it('should support multiple content types', () => {
      const multiResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: 'Analysis result:'
          },
          {
            type: 'image',
            data: 'chart-data',
            mimeType: 'image/svg+xml'
          },
          {
            type: 'resource',
            data: '{"results": []}',
            mimeType: 'application/json'
          }
        ]
      };

      expect(multiResult.content).toHaveLength(3);
      expect(multiResult.content[0].type).toBe('text');
      expect(multiResult.content[1].type).toBe('image');
      expect(multiResult.content[2].type).toBe('resource');
    });
  });

  describe('MCPConnectionInfo', () => {
    it('should provide complete connection information', () => {
      const connectionInfo: MCPConnectionInfo = {
        name: 'test-connection',
        status: 'connected',
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js']
        },
        tools: [
          {
            name: 'test-tool',
            description: 'Test tool',
            inputSchema: { type: 'object' }
          }
        ],
        lastConnected: new Date('2024-01-01T10:00:00Z'),
        lastError: undefined
      };

      expect(connectionInfo.name).toBe('test-connection');
      expect(connectionInfo.status).toBe('connected');
      expect(connectionInfo.config.name).toBe('test-server');
      expect(connectionInfo.tools).toHaveLength(1);
      expect(connectionInfo.tools[0].name).toBe('test-tool');
      expect(connectionInfo.lastConnected).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('should support error state with error message', () => {
      const errorConnection: MCPConnectionInfo = {
        name: 'failed-connection',
        status: 'error',
        config: {
          name: 'broken-server',
          command: 'nonexistent',
          args: []
        },
        tools: [],
        lastError: 'Connection timeout'
      };

      expect(errorConnection.status).toBe('error');
      expect(errorConnection.tools).toHaveLength(0);
      expect(errorConnection.lastError).toBe('Connection timeout');
      expect(errorConnection.lastConnected).toBeUndefined();
    });
  });

  describe('MCPClientConfig', () => {
    it('should define client configuration', () => {
      const clientConfig: MCPClientConfig = {
        connectionTimeout: 30000,
        requestTimeout: 10000,
        maxRetries: 3,
        retryDelay: 1000
      };

      expect(clientConfig.connectionTimeout).toBe(30000);
      expect(clientConfig.requestTimeout).toBe(10000);
      expect(clientConfig.maxRetries).toBe(3);
      expect(clientConfig.retryDelay).toBe(1000);
    });
  });

  describe('MCPServerCapabilities', () => {
    it('should define server capabilities', () => {
      const capabilities: MCPServerCapabilities = {
        tools: {
          listChanged: true
        },
        resources: {
          listChanged: false
        },
        prompts: {
          listChanged: true
        }
      };

      expect(capabilities.tools?.listChanged).toBe(true);
      expect(capabilities.resources?.listChanged).toBe(false);
      expect(capabilities.prompts?.listChanged).toBe(true);
    });

    it('should support minimal capabilities', () => {
      const minimalCapabilities: MCPServerCapabilities = {
        tools: {}
      };

      expect(minimalCapabilities.tools).toBeDefined();
      expect(minimalCapabilities.tools?.listChanged).toBeUndefined();
      expect(minimalCapabilities.resources).toBeUndefined();
      expect(minimalCapabilities.prompts).toBeUndefined();
    });

    it('should support empty capabilities', () => {
      const emptyCapabilities: MCPServerCapabilities = {};

      expect(emptyCapabilities.tools).toBeUndefined();
      expect(emptyCapabilities.resources).toBeUndefined();
      expect(emptyCapabilities.prompts).toBeUndefined();
    });
  });

  describe('Type Compatibility', () => {
    it('should support type composition', () => {
      interface ExtendedConnectionInfo extends MCPConnectionInfo {
        customField: string;
      }

      const extended: ExtendedConnectionInfo = {
        name: 'extended-connection',
        status: 'connected',
        config: {
          name: 'server',
          command: 'node',
          args: []
        },
        tools: [],
        customField: 'custom value'
      };

      expect(extended.customField).toBe('custom value');
      expect(extended.name).toBe('extended-connection');
    });

    it('should validate content type constraints', () => {
      const validTypes: Array<'text' | 'image' | 'resource'> = ['text', 'image', 'resource'];
      
      validTypes.forEach(type => {
        const content = {
          type,
          text: type === 'text' ? 'sample text' : undefined,
          data: type !== 'text' ? 'sample data' : undefined,
          mimeType: type !== 'text' ? 'application/octet-stream' : undefined
        };

        expect(content.type).toBe(type);
      });
    });
  });
});