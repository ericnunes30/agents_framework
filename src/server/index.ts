import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from '../websocket/WebSocketServer.js';
import { StateManager } from '../state/StateManager.js';
import { AgentRunner } from '../agents/AgentRunner.js';
import { CrewRunner } from '../crews/CrewRunner.js';
import { ConfigLoader } from '../config/loader.js';
import { MCPClient } from '../tools/mcp/MCPClient.js';
import { HybridAgentFrameworkServer } from './hybrid.js';

// Load environment variables
dotenv.config();

// Use hybrid server by default
const USE_HYBRID = process.env.USE_HYBRID !== 'false';

/**
 * Main server class for the Agent Framework
 */
export class AgentFrameworkServer {
  private app: express.Application;
  private server: any;
  private wsServer!: WebSocketServer;
  private stateManager!: StateManager;
  private agentRunner!: AgentRunner;
  private crewRunner!: CrewRunner;
  private mcpClient!: MCPClient;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.stateManager.healthCheck();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          health
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // System overview
    this.app.get('/api/overview', async (req, res) => {
      try {
        const overview = await this.crewRunner.getSystemOverview();
        res.json(overview);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Agents endpoints
    this.setupAgentRoutes();
    
    // Crews endpoints
    this.setupCrewRoutes();
    
    // Configuration endpoints
    this.setupConfigRoutes();
    
    // Tool endpoints
    this.setupToolRoutes();
  }

  /**
   * Setup agent-related routes
   */
  private setupAgentRoutes(): void {
    // List all agents
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = await this.agentRunner.getAllAgentStates();
        res.json(agents);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get specific agent
    this.app.get('/api/agents/:agentId', async (req, res) => {
      try {
        const agent = await this.agentRunner.getAgentState(req.params.agentId);
        if (!agent) {
          return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(agent);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Create new agent
    this.app.post('/api/agents', async (req, res) => {
      try {
        const { configPath } = req.body;
        if (!configPath) {
          return res.status(400).json({ error: 'configPath is required' });
        }

        const agent = await this.agentRunner.createAgentFromConfig(configPath);
        res.json({
          message: 'Agent created successfully',
          agentId: agent.getDefinition().id
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Execute agent (new stateless API)
    this.app.post('/api/agents/execute', async (req, res) => {
      try {
        const requestData = req.body;
        
        const metadata = {
          configPath: requestData.configPath,
          task: requestData.task,
          input: requestData.input
        };

        const executionId = await this.stateManager.createExecution(
          'agent',
          metadata,
          requestData.options?.ttl || 3600
        );

        // Execute asynchronously
        this.executeAgentAsync(executionId, requestData);

        res.json({
          executionId,
          status: 'started'
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get execution status
    this.app.get('/api/agents/status/:executionId', async (req, res) => {
      try {
        const status = await this.stateManager.getExecutionStatus(req.params.executionId);
        if (!status) {
          return res.status(404).json({ error: 'Execution not found' });
        }
        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get execution results
    this.app.get('/api/agents/results/:executionId', async (req, res) => {
      try {
        const result = await this.stateManager.getExecutionResult(req.params.executionId);
        if (!result) {
          return res.status(404).json({ error: 'Result not found or execution not completed' });
        }
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // List active executions
    this.app.get('/api/agents/active', async (req, res) => {
      try {
        const activeExecutions = await this.stateManager.getActiveExecutions();
        const agentExecutions = activeExecutions.filter(id => id.startsWith('agent_'));
        res.json({
          executions: agentExecutions
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Execute task with agent
    this.app.post('/api/agents/:agentId/execute', async (req, res) => {
      try {
        const { task, context } = req.body;
        if (!task) {
          return res.status(400).json({ error: 'task is required' });
        }

        const result = await this.agentRunner.executeTask(
          req.params.agentId,
          task,
          context || {}
        );

        res.json({ result });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Reset agent
    this.app.post('/api/agents/:agentId/reset', async (req, res) => {
      try {
        await this.agentRunner.resetAgent(req.params.agentId);
        res.json({ message: 'Agent reset successfully' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Setup crew-related routes
   */
  private setupCrewRoutes(): void {
    // List all crews
    this.app.get('/api/crews', async (req, res) => {
      try {
        const crews = await this.crewRunner.getAllCrewStates();
        res.json(crews);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get specific crew
    this.app.get('/api/crews/:crewId', async (req, res) => {
      try {
        const crew = await this.crewRunner.getCrewState(req.params.crewId);
        if (!crew) {
          return res.status(404).json({ error: 'Crew not found' });
        }
        res.json(crew);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Create new crew
    this.app.post('/api/crews', async (req, res) => {
      try {
        const { configPath } = req.body;
        if (!configPath) {
          return res.status(400).json({ error: 'configPath is required' });
        }

        const crew = await this.crewRunner.createCrewFromConfig(configPath);
        res.json({
          message: 'Crew created successfully',
          crewId: crew.getDefinition().id
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Execute crew
    this.app.post('/api/crews/:crewId/execute', async (req, res) => {
      try {
        const { input, context } = req.body;
        if (!input) {
          return res.status(400).json({ error: 'input is required' });
        }

        const result = await this.crewRunner.executeCrewWithContext(
          req.params.crewId,
          input,
          context || {}
        );

        res.json({ result });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get crew execution logs
    this.app.get('/api/crews/:crewId/logs', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const logs = await this.crewRunner.getCrewLogs(req.params.crewId, limit);
        res.json(logs);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Reset crew
    this.app.post('/api/crews/:crewId/reset', async (req, res) => {
      try {
        await this.crewRunner.resetCrew(req.params.crewId);
        res.json({ message: 'Crew reset successfully' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Cancel crew execution
    this.app.post('/api/crews/:crewId/cancel', async (req, res) => {
      try {
        const crew = this.crewRunner.getCrew(req.params.crewId);
        if (!crew) {
          return res.status(404).json({ error: 'Crew not found' });
        }

        await crew.cancel();
        res.json({ message: 'Crew execution cancelled' });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Setup configuration routes
   */
  private setupConfigRoutes(): void {
    // List available agent configurations
    this.app.get('/api/config/agents', async (req, res) => {
      try {
        const agents = ConfigLoader.loadAllAgents();
        res.json(agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role
        })));
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // List available crew configurations
    this.app.get('/api/config/crews', async (req, res) => {
      try {
        const crews = ConfigLoader.loadAllCrews();
        res.json(crews.map(crew => ({
          id: crew.id,
          name: crew.name,
          process: crew.process
        })));
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Validate configuration
    this.app.post('/api/config/validate', async (req, res) => {
      try {
        const { type, configPath } = req.body;
        if (!type || !configPath) {
          return res.status(400).json({ error: 'type and configPath are required' });
        }

        if (type === 'agent') {
          const agent = ConfigLoader.loadAgentConfig(configPath);
          res.json({ valid: true, agent });
        } else if (type === 'crew') {
          const crew = ConfigLoader.loadCrewConfig(configPath);
          const validation = await this.crewRunner.validateCrew(crew);
          res.json({ valid: validation.valid, crew, errors: validation.errors });
        } else {
          res.status(400).json({ error: 'Invalid type. Must be "agent" or "crew"' });
        }
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Setup tool-related routes
   */
  private setupToolRoutes(): void {
    // List available tools
    this.app.get('/api/tools', async (req, res) => {
      try {
        const nativeTools = ['web_scraper', 'redis'];
        const mcpTools = this.mcpClient.getAllTools();
        
        res.json({ 
          native: nativeTools,
          mcp: mcpTools,
          total: nativeTools.length + mcpTools.length
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // MCP client status
    this.app.get('/api/mcp/status', async (req, res) => {
      try {
        const connections = this.mcpClient.getConnectionsInfo();
        const healthResults = await this.mcpClient.healthCheck();
        
        res.json({
          status: 'running',
          connections: connections.length,
          connectedServers: this.mcpClient.getConnectedServers(),
          health: healthResults
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    // Initialize core services
    this.stateManager = new StateManager();
    this.agentRunner = new AgentRunner(this.stateManager);
    this.crewRunner = new CrewRunner(this.stateManager, this.agentRunner);
    this.mcpClient = new MCPClient();
    
    // Configure external MCP servers from environment
    this.mcpClient.configureFromEnvironment().catch(error => {
      console.warn('Failed to configure external MCP servers:', error);
    });

    // Initialize WebSocket server
    this.wsServer = new WebSocketServer(this.server, this.stateManager);

    // MCP Client is initialized and ready for external connections

    console.log('Agent Framework server initialized');
  }

  /**
   * Start the server
   */
  async start(port: number = 3000): Promise<void> {
    await this.initialize();

    this.server.listen(port, () => {
      console.log(`Agent Framework server running on port ${port}`);
      console.log(`WebSocket server available at ws://localhost:${port}/ws`);
      console.log(`Health check: http://localhost:${port}/health`);
    });
  }

  /**
   * Execute agent task asynchronously
   */
  private async executeAgentAsync(executionId: string, request: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.stateManager.updateExecutionStatus(
        executionId,
        'running',
        0,
        'initializing'
      );

      // Create agent from config
      const agent = await this.agentRunner.createAgentFromConfig(request.configPath);
      const agentId = agent.getDefinition().id;

      await this.stateManager.updateExecutionStatus(
        executionId,
        'running',
        0.2,
        'agent_created'
      );

      // Execute the task
      const result = await this.agentRunner.executeTask(
        agentId,
        request.task || request.input || '',
        request.context || {}
      );

      const executionTime = Date.now() - startTime;

      await this.stateManager.updateExecutionStatus(
        executionId,
        'completed',
        1.0,
        'completed',
        result
      );

      await this.stateManager.incrementCompletedCount();

    } catch (error) {
      console.error(`Agent execution failed for ${executionId}:`, error);
      
      await this.stateManager.updateExecutionStatus(
        executionId,
        'failed',
        undefined,
        'failed',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    
    await this.mcpClient.disconnectAll();
    await this.crewRunner.shutdown();
    await this.agentRunner.shutdown();
    await this.wsServer.close();
    await this.stateManager.close();
    
    this.server.close(() => {
      console.log('Server shutdown complete');
    });
  }
}

// Start server if this file is run directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
  try {
    // Handle import.meta.url safely for Jest compatibility
    const currentFile = typeof import.meta !== 'undefined' && import.meta.url 
      ? new URL(import.meta.url).pathname 
      : process.argv[1];
    const scriptFile = process.argv[1];
    
    if (currentFile.endsWith(scriptFile) || scriptFile.endsWith('index.js')) {
      const port = parseInt(process.env.PORT || '3000');
      
      if (USE_HYBRID) {
        console.log('🔄 Starting Hybrid Agent Framework Server...');
        const server = new HybridAgentFrameworkServer();
        server.start(port).catch(console.error);
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
          await server.shutdown();
          process.exit(0);
        });
        
        process.on('SIGINT', async () => {
          await server.shutdown();
          process.exit(0);
        });
      } else {
        console.log('🔄 Starting Legacy Agent Framework Server...');
        const server = new AgentFrameworkServer();
        server.start(port).catch(console.error);
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
          await server.shutdown();
          process.exit(0);
        });
        
        process.on('SIGINT', async () => {
          await server.shutdown();
          process.exit(0);
        });
      }
    }
  } catch (error) {
    // Silently ignore import.meta errors in test environment
  }
}

export default AgentFrameworkServer;