import { Router, Request, Response } from 'express';
import { MCPClient } from '../../tools/mcp/MCPClient.js';

export const createToolsRouter = (mcpClient: MCPClient): Router => {
  const router = Router();

  // List available tools
  router.get('/', async (req: Request, res: Response) => {
    try {
      const nativeTools = ['web_scraper', 'redis'];
      const mcpTools = mcpClient.getAllTools();
      
      res.json({ 
        native: nativeTools.map(name => ({ name, type: 'native' })),
        mcp: mcpTools.map(tool => ({ ...tool, type: 'mcp' })),
        total: nativeTools.length + mcpTools.length
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get native tools information
  router.get('/native', async (req: Request, res: Response) => {
    try {
      const nativeTools = [
        {
          name: 'web_scraper',
          description: 'Web scraping tool using Playwright',
          capabilities: ['scrape_url', 'extract_text', 'take_screenshot']
        },
        {
          name: 'redis',
          description: 'Redis operations tool',
          capabilities: ['get', 'set', 'delete', 'exists', 'keys']
        }
      ];

      res.json(nativeTools);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // MCP client status and tools
  router.get('/mcp', async (req: Request, res: Response) => {
    try {
      const connections = mcpClient.getConnectionsInfo();
      const healthResults = await mcpClient.healthCheck();
      const tools = mcpClient.getAllTools();
      
      res.json({
        status: 'running',
        connections: connections.length,
        connectedServers: mcpClient.getConnectedServers(),
        tools,
        health: healthResults
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get MCP server status
  router.get('/mcp/status', async (req: Request, res: Response) => {
    try {
      const connections = mcpClient.getConnectionsInfo();
      const healthResults = await mcpClient.healthCheck();
      
      res.json({
        status: 'running',
        connections: connections.length,
        connectedServers: mcpClient.getConnectedServers(),
        health: healthResults,
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific MCP server information
  router.get('/mcp/:serverName', async (req: Request, res: Response) => {
    try {
      const serverName = req.params.serverName;
      const connections = mcpClient.getConnectionsInfo();
      const connection = connections.find(conn => conn.name === serverName);
      
      if (!connection) {
        return res.status(404).json({ error: 'MCP server not found' });
      }

      const tools = mcpClient.getAllTools().filter(tool => tool.serverName === serverName);
      const health = await mcpClient.healthCheck();
      const serverHealth = Array.isArray(health) ? health.find((h: any) => h.status === 'healthy') : health;

      res.json({
        connection,
        tools,
        health: serverHealth,
        toolCount: tools.length
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};