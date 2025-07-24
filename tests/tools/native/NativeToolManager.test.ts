import { NativeToolManager } from '../../../src/tools/native/NativeToolManager.js';
import { WebScraperTool } from '../../../src/tools/native/WebScraperTool.js';
import { RedisTool } from '../../../src/tools/native/RedisTool.js';

jest.mock('../../../src/tools/native/WebScraperTool.js');
jest.mock('../../../src/tools/native/RedisTool.js');
jest.mock('ioredis');

const MockWebScraperTool = WebScraperTool as jest.MockedClass<typeof WebScraperTool>;
const MockRedisTool = RedisTool as jest.MockedClass<typeof RedisTool>;

describe('NativeToolManager', () => {
  let manager: NativeToolManager;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebScraperTool.mockImplementation(() => ({
      name: 'web_scraper',
      description: 'Web scraping tool',
      execute: jest.fn(),
      validate: jest.fn(),
      getSchema: jest.fn().mockReturnValue({ name: 'web_scraper' }),
      close: jest.fn()
    } as any));

    MockRedisTool.mockImplementation(() => ({
      name: 'redis',
      description: 'Redis operations tool',
      execute: jest.fn(),
      validate: jest.fn(),
      getSchema: jest.fn().mockReturnValue({ name: 'redis' }),
      close: jest.fn()
    } as any));

    manager = new NativeToolManager();
  });

  describe('constructor', () => {
    it('should register built-in tools on initialization', () => {
      expect(MockWebScraperTool).toHaveBeenCalled();
      expect(MockRedisTool).toHaveBeenCalled();
    });

    it('should have both web_scraper and redis tools registered', () => {
      expect(manager.hasTool('web_scraper')).toBe(true);
      expect(manager.hasTool('redis')).toBe(true);
    });
  });

  describe('register', () => {
    it('should register a new tool', () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        execute: jest.fn(),
        validate: jest.fn(),
        getSchema: jest.fn()
      };

      manager.register(mockTool);
      
      expect(manager.hasTool('test_tool')).toBe(true);
      expect(manager.getTool('test_tool')).toBe(mockTool);
    });

    it('should overwrite existing tool with same name', () => {
      const originalTool = manager.getTool('web_scraper');
      const newTool = {
        name: 'web_scraper',
        description: 'New web scraper',
        execute: jest.fn(),
        validate: jest.fn(),
        getSchema: jest.fn()
      };

      manager.register(newTool);
      
      expect(manager.getTool('web_scraper')).toBe(newTool);
      expect(manager.getTool('web_scraper')).not.toBe(originalTool);
    });
  });

  describe('getTool', () => {
    it('should return tool by name', () => {
      const tool = manager.getTool('web_scraper');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('web_scraper');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = manager.getTool('non_existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('listTools', () => {
    it('should return list of all registered tool names', () => {
      const tools = manager.listTools();
      expect(tools).toContain('web_scraper');
      expect(tools).toContain('redis');
      expect(tools.length).toBe(2);
    });
  });

  describe('getAllTools', () => {
    it('should return array of all tools', () => {
      const tools = manager.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools.some(tool => tool.name === 'web_scraper')).toBe(true);
      expect(tools.some(tool => tool.name === 'redis')).toBe(true);
    });
  });

  describe('executeTool', () => {
    it('should execute tool successfully', async () => {
      const mockResult = { success: true, data: { test: 'data' } };
      const redisTool = manager.getTool('redis');
      if (redisTool && redisTool.execute) {
        (redisTool.execute as jest.Mock).mockResolvedValue(mockResult);
        redisTool.validate = jest.fn().mockReturnValue(true);
      }

      const result = await manager.executeTool('redis', { operation: 'get', key: 'test' });
      
      expect(result).toEqual(mockResult);
      expect(redisTool?.execute).toHaveBeenCalledWith({ operation: 'get', key: 'test' });
    });

    it('should throw error for non-existent tool', async () => {
      await expect(manager.executeTool('non_existent', {}))
        .rejects.toThrow('Native tool not found: non_existent');
    });

    it('should throw error for invalid parameters', async () => {
      const redisTool = manager.getTool('redis');
      if (redisTool) {
        redisTool.validate = jest.fn().mockReturnValue(false);
      }

      await expect(manager.executeTool('redis', { invalid: 'params' }))
        .rejects.toThrow('Invalid parameters for tool: redis');
    });

    it('should handle tool execution errors', async () => {
      const redisTool = manager.getTool('redis');
      if (redisTool && redisTool.execute) {
        (redisTool.execute as jest.Mock).mockRejectedValue(new Error('Execution failed'));
        redisTool.validate = jest.fn().mockReturnValue(true);
      }

      await expect(manager.executeTool('redis', { operation: 'get', key: 'test' }))
        .rejects.toThrow('Execution failed');
    });
  });

  describe('getToolSchemas', () => {
    it('should return schemas for all tools', () => {
      const schemas = manager.getToolSchemas();
      
      expect(schemas).toHaveProperty('web_scraper');
      expect(schemas).toHaveProperty('redis');
      expect(schemas.web_scraper).toEqual({ name: 'web_scraper' });
      expect(schemas.redis).toEqual({ name: 'redis' });
    });
  });

  describe('getToolInfo', () => {
    it('should return tool information for existing tool', () => {
      const info = manager.getToolInfo('web_scraper');
      
      expect(info).toEqual({
        name: 'web_scraper',
        description: 'Web scraping tool',
        schema: { name: 'web_scraper' }
      });
    });

    it('should return null for non-existent tool', () => {
      const info = manager.getToolInfo('non_existent');
      expect(info).toBeNull();
    });
  });

  describe('hasTool', () => {
    it('should return true for existing tool', () => {
      expect(manager.hasTool('web_scraper')).toBe(true);
      expect(manager.hasTool('redis')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(manager.hasTool('non_existent')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status for all tools', async () => {
      const health = await manager.healthCheck();
      
      expect(health).toEqual({
        web_scraper: { status: 'healthy' },
        redis: { status: 'healthy' }
      });
    });

    it('should handle tools with missing methods', async () => {
      const brokenTool = {
        name: 'broken_tool',
        description: 'Broken tool',
        execute: jest.fn(),
        validate: jest.fn(),
        getSchema: jest.fn()
      };
      
      // Make the tool broken by removing execute method
      delete (brokenTool as any).execute;

      manager.register(brokenTool);
      const health = await manager.healthCheck();
      
      expect(health.broken_tool).toEqual({
        status: 'unhealthy',
        error: 'Missing required methods'
      });
    });

    it('should handle tools throwing errors during health check', async () => {
      const errorTool = {
        name: 'error_tool',
        description: 'Error tool',
        execute: jest.fn(),
        validate: jest.fn(),
        getSchema: jest.fn()
      };

      // Make the tool throw error during health check
      Object.defineProperty(errorTool, 'execute', {
        get() {
          throw new Error('Tool error');
        }
      });

      manager.register(errorTool);
      const health = await manager.healthCheck();
      
      expect(health.error_tool.status).toBe('unhealthy');
      expect(health.error_tool.error).toBe('Tool error');
    });
  });

});