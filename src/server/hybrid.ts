import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Core components
import { WebSocketServer } from '../websocket/WebSocketServer.js';
import { StateManager } from '../state/StateManager.js';
import { AgentRunner } from '../agents/AgentRunner.js';
import { CrewRunner } from '../crews/CrewRunner.js';
import { MCPClient } from '../tools/mcp/MCPClient.js';

// HTTP layer
import { corsMiddleware } from '../http/middleware/cors.js';
import { createRateLimiter } from '../http/middleware/rateLimit.js';
import { errorHandler } from '../http/middleware/validation.js';
import { RedisService } from '../http/services/RedisService.js';
import { TTLManager } from '../http/services/TTLManager.js';

// WebSocket layer
import { PubSubManager } from '../websocket/PubSubManager.js';
import { StreamingManager } from '../websocket/StreamingManager.js';

// Routes
import { createHealthRouter } from '../http/routes/health.js';
import { createSystemRouter } from '../http/routes/system.js';
import { createAgentsRouter } from '../http/routes/agents.js';
import { createCrewsRouter } from '../http/routes/crews.js';
import { createConfigRouter } from '../http/routes/config.js';
import { createToolsRouter } from '../http/routes/tools.js';

// Redis setup
import { createRedisConnections } from './redis.js';

// Load environment variables
dotenv.config();

export class HybridAgentFrameworkServer {
  private app: express.Application;
  private server: any;
  
  // Core services
  private wsServer!: WebSocketServer;
  private stateManager!: StateManager;
  private agentRunner!: AgentRunner;
  private crewRunner!: CrewRunner;
  private mcpClient!: MCPClient;
  
  // HTTP services
  private redisService!: RedisService;
  private ttlManager!: TTLManager;
  
  // WebSocket services
  private pubSubManager!: PubSubManager;
  private streamingManager!: StreamingManager;
  
  // Redis connections
  private redis: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
  }

  async initialize(): Promise<void> {
    // Initialize Redis connections
    this.redis = createRedisConnections();
    await this.redis.main.connect();
    await this.redis.subscriber.connect();
    await this.redis.publisher.connect();

    // Initialize core services
    this.stateManager = new StateManager();
    this.agentRunner = new AgentRunner(this.stateManager);
    this.crewRunner = new CrewRunner(this.stateManager, this.agentRunner);
    this.mcpClient = new MCPClient();
    
    // Initialize WebSocket services
    this.pubSubManager = new PubSubManager(this.redis.subscriber, this.redis.publisher);
    this.streamingManager = new StreamingManager(this.pubSubManager);
    
    // Initialize HTTP services (with PubSub integration)
    this.redisService = new RedisService(this.redis.main, this.pubSubManager);
    this.ttlManager = new TTLManager(this.redis.main);
    this.ttlManager.start();

    // Configure external MCP servers
    this.mcpClient.configureFromEnvironment().catch(error => {
      console.warn('Failed to configure external MCP servers:', error);
    });

    // Initialize WebSocket server with streaming manager
    this.wsServer = new WebSocketServer(this.server, this.stateManager);
    this.setupWebSocketStreaming();

    // Setup Express middleware and routes
    this.setupMiddleware();
    this.setupRoutes();

    console.log('Hybrid Agent Framework server initialized');
  }

  private setupWebSocketStreaming(): void {
    // Handle new WebSocket connections for streaming
    this.wsServer.on('connection', (clientId: string, client: any) => {
      this.streamingManager.addClient(clientId, client);
    });

    // Handle WebSocket disconnections
    this.wsServer.on('disconnect', (clientId: string) => {
      this.streamingManager.removeClient(clientId);
    });

    // Handle execution subscription requests
    this.wsServer.on('message', async (clientId: string, message: any) => {
      if (message.type === 'subscribe_execution') {
        await this.streamingManager.subscribeToExecution(
          clientId,
          message.data.executionId,
          message.data.type || 'agent'
        );
      }
      
      if (message.type === 'unsubscribe_execution') {
        await this.streamingManager.unsubscribeFromExecution(
          clientId,
          message.data.executionId
        );
      }
    });
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(corsMiddleware);
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Rate limiting for API routes
    const rateLimiter = createRateLimiter(this.redis.main, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use('/api', rateLimiter.middleware());
  }

  private setupRoutes(): void {
    // Health check (no /api prefix)
    this.app.use('/health', createHealthRouter(this.stateManager, this.redisService));

    // API routes
    this.app.use('/api/system', createSystemRouter(
      this.stateManager,
      this.redisService,
      this.ttlManager,
      this.crewRunner
    ));

    this.app.use('/api/agents', createAgentsRouter(
      this.agentRunner,
      this.redisService
    ));

    this.app.use('/api/crews', createCrewsRouter(
      this.crewRunner,
      this.agentRunner,
      this.redisService
    ));

    this.app.use('/api/config', createConfigRouter(
      this.crewRunner,
      this.redisService
    ));

    this.app.use('/api/tools', createToolsRouter(this.mcpClient));

    // Backward compatibility - system overview
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

    // Error handling middleware (must be last)
    this.app.use(errorHandler);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.originalUrl,
        timestamp: new Date()
      });
    });
  }

  async start(port: number = 3000): Promise<void> {
    await this.initialize();

    this.server.listen(port, () => {
      console.log(`🚀 Hybrid Agent Framework server running on port ${port}`);
      console.log(`📡 WebSocket server available at ws://localhost:${port}/ws`);
      console.log(`🔍 Health check: http://localhost:${port}/health`);
      console.log(`📊 System stats: http://localhost:${port}/api/system/stats`);
      console.log(`🤖 Agents API: http://localhost:${port}/api/agents`);
      console.log(`👥 Crews API: http://localhost:${port}/api/crews`);
      console.log('');
      console.log('🎯 New Stateless APIs:');
      console.log(`   POST /api/agents/execute - Execute agent directly`);
      console.log(`   GET  /api/agents/status/:id - Get execution status`);
      console.log(`   GET  /api/agents/results/:id - Get execution results`);
      console.log(`   POST /api/crews/execute - Execute crew directly`);
      console.log(`   GET  /api/crews/status/:id - Get execution status`);
      console.log(`   GET  /api/crews/results/:id - Get execution results`);
    });
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down hybrid server...');
    
    // Stop TTL manager
    if (this.ttlManager) {
      this.ttlManager.stop();
    }
    
    // Cleanup WebSocket services
    if (this.streamingManager) {
      await this.streamingManager.cleanup();
    }
    if (this.pubSubManager) {
      await this.pubSubManager.close();
    }
    
    // Shutdown core services
    if (this.mcpClient) {
      await this.mcpClient.disconnectAll();
    }
    if (this.crewRunner) {
      await this.crewRunner.shutdown();
    }
    if (this.agentRunner) {
      await this.agentRunner.shutdown();
    }
    if (this.wsServer) {
      await this.wsServer.close();
    }
    if (this.stateManager) {
      await this.stateManager.close();
    }
    
    // Close Redis connections
    if (this.redis) {
      if (this.redis.main) await this.redis.main.disconnect();
      if (this.redis.subscriber) await this.redis.subscriber.disconnect();
      if (this.redis.publisher) await this.redis.publisher.disconnect();
    }
    
    return new Promise<void>((resolve) => {
      this.server.close(() => {
        console.log('Hybrid server shutdown complete');
        resolve();
      });
    });
  }
}

// Start server if this file is run directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
  try {
    // Use process.argv[1] directly for compatibility with tests
    const scriptFile = process.argv[1];
    
    if (scriptFile.endsWith('hybrid.js') || scriptFile.includes('hybrid.ts')) {
      const server = new HybridAgentFrameworkServer();
      const port = parseInt(process.env.PORT || '3000');
      
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
  } catch (error) {
    // Silently ignore import.meta errors in test environment
  }
}

export default HybridAgentFrameworkServer;