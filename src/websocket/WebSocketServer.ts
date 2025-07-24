import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  WebSocketMessage, 
  WebSocketMessageType, 
  WebSocketClient, 
  SubscriptionRequest,
  ConnectionStats,
  WebSocketConfig 
} from './types.js';
import { StateManager } from '../state/StateManager.js';
import { StateEvent } from '../state/types.js';

/**
 * Real-time WebSocket server for agent and crew communication
 */
export class WebSocketServer extends EventEmitter {
  private wss!: WSServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private stateManager: StateManager;
  private config: WebSocketConfig;
  private heartbeatInterval?: NodeJS.Timeout;
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    connections: 0,
    startTime: Date.now()
  };

  constructor(
    server: Server,
    stateManager: StateManager,
    config: WebSocketConfig = {}
  ) {
    super();
    
    this.config = {
      port: 3001,
      host: 'localhost',
      path: '/ws',
      heartbeatInterval: 30000,
      heartbeatTimeout: 5000,
      maxPayload: 1024 * 1024, // 1MB
      compression: true,
      ...config
    };

    this.stateManager = stateManager;
    this.setupWebSocketServer(server);
    this.setupStateManagerListeners();
    this.startHeartbeat();
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocketServer(server: Server): void {
    this.wss = new WSServer({
      server,
      path: this.config.path,
      maxPayload: this.config.maxPayload,
      perMessageDeflate: this.config.compression ? {
        threshold: 1024,
        concurrencyLimit: 10,
        serverMaxWindowBits: 15,
        clientMaxWindowBits: 15,
        serverNoContextTakeover: true,
        clientNoContextTakeover: true
      } : false
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => this.emit('error', error));
  }

  /**
   * Setup state manager listeners
   */
  private setupStateManagerListeners(): void {
    this.stateManager.on('state:update', (event: StateEvent) => {
      this.handleStateUpdate(event);
    });

    this.stateManager.on('error', (error) => {
      this.broadcast('system_update', {
        type: 'error',
        message: error.message,
        timestamp: new Date()
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: any): void {
    const clientId = uuidv4();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: {
        agents: new Set(),
        crews: new Set()
      },
      connectedAt: new Date(),
      lastPing: new Date()
    };

    this.clients.set(clientId, client);
    this.stats.connections++;

    console.log(`WebSocket client connected: ${clientId}`);

    // Setup socket event handlers
    socket.on('message', (data) => this.handleMessage(clientId, Buffer.from(data.toString())));
    socket.on('close', () => this.handleDisconnection(clientId));
    socket.on('error', (error) => this.handleError(clientId, error));
    socket.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'system_update',
      data: {
        message: 'Connected to Agent Framework WebSocket',
        clientId,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: Buffer): void {
    this.stats.messagesReceived++;

    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      
      switch (message.type) {
        case 'subscribe_agent':
          this.handleSubscribeAgent(clientId, message.data);
          break;
        case 'subscribe_crew':
          this.handleSubscribeCrew(clientId, message.data);
          break;
        case 'unsubscribe_agent':
          this.handleUnsubscribeAgent(clientId, message.data);
          break;
        case 'unsubscribe_crew':
          this.handleUnsubscribeCrew(clientId, message.data);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(clientId, `Invalid message format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle agent subscription
   */
  private handleSubscribeAgent(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const agentId = data.agentId;
    if (!agentId) {
      this.sendError(clientId, 'agentId is required');
      return;
    }

    client.subscriptions.agents.add(agentId);
    
    this.sendToClient(clientId, {
      type: 'system_update',
      data: {
        message: `Subscribed to agent: ${agentId}`,
        agentId
      },
      timestamp: new Date()
    });

    // Send current state
    this.sendAgentState(clientId, agentId);
  }

  /**
   * Handle crew subscription
   */
  private handleSubscribeCrew(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const crewId = data.crewId;
    if (!crewId) {
      this.sendError(clientId, 'crewId is required');
      return;
    }

    client.subscriptions.crews.add(crewId);
    
    this.sendToClient(clientId, {
      type: 'system_update',
      data: {
        message: `Subscribed to crew: ${crewId}`,
        crewId
      },
      timestamp: new Date()
    });

    // Send current state
    this.sendCrewState(clientId, crewId);
  }

  /**
   * Handle agent unsubscription
   */
  private handleUnsubscribeAgent(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const agentId = data.agentId;
    if (!agentId) {
      this.sendError(clientId, 'agentId is required');
      return;
    }

    client.subscriptions.agents.delete(agentId);
    
    this.sendToClient(clientId, {
      type: 'system_update',
      data: {
        message: `Unsubscribed from agent: ${agentId}`,
        agentId
      },
      timestamp: new Date()
    });
  }

  /**
   * Handle crew unsubscription
   */
  private handleUnsubscribeCrew(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const crewId = data.crewId;
    if (!crewId) {
      this.sendError(clientId, 'crewId is required');
      return;
    }

    client.subscriptions.crews.delete(crewId);
    
    this.sendToClient(clientId, {
      type: 'system_update',
      data: {
        message: `Unsubscribed from crew: ${crewId}`,
        crewId
      },
      timestamp: new Date()
    });
  }

  /**
   * Handle ping message
   */
  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
      this.sendToClient(clientId, {
        type: 'pong',
        data: { timestamp: new Date() },
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
  }

  /**
   * Handle state updates from StateManager
   */
  private handleStateUpdate(event: StateEvent): void {
    switch (event.entityType) {
      case 'agent':
        this.broadcastToAgentSubscribers(event.entityId, {
          type: 'agent_update',
          data: event.data,
          timestamp: event.timestamp
        });
        break;
      case 'crew':
        this.broadcastToCrewSubscribers(event.entityId, {
          type: 'crew_update',
          data: event.data,
          timestamp: event.timestamp
        });
        break;
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    this.stats.connections--;
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(clientId: string, error: Error): void {
    console.error(`WebSocket error for client ${clientId}:`, error);
    this.clients.delete(clientId);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
        this.stats.messagesSent++;
      } catch (error) {
        console.error('Failed to send message to client:', error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      data: { message: error },
      timestamp: new Date()
    });
  }

  /**
   * Send current agent state to client
   */
  private async sendAgentState(clientId: string, agentId: string): Promise<void> {
    const state = await this.stateManager.getAgentState(agentId);
    if (state) {
      this.sendToClient(clientId, {
        type: 'agent_update',
        data: state,
        timestamp: new Date()
      });
    }
  }

  /**
   * Send current crew state to client
   */
  private async sendCrewState(clientId: string, crewId: string): Promise<void> {
    const state = await this.stateManager.getCrewState(crewId);
    if (state) {
      this.sendToClient(clientId, {
        type: 'crew_update',
        data: state,
        timestamp: new Date()
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(type: WebSocketMessageType, data: any, options: { exclude?: string[] } = {}): void {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date()
    };

    const excludeSet = new Set(options.exclude || []);

    this.clients.forEach((client, clientId) => {
      if (!excludeSet.has(clientId) && client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
          this.stats.messagesSent++;
        } catch (error) {
          console.error('Failed to broadcast message:', error);
          this.clients.delete(clientId);
        }
      }
    });
  }

  /**
   * Broadcast message to agent subscribers
   */
  private broadcastToAgentSubscribers(agentId: string, message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.agents.has(agentId) && client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
      }
    });
  }

  /**
   * Broadcast message to crew subscribers
   */
  private broadcastToCrewSubscribers(crewId: string, message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.crews.has(crewId) && client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.socket.readyState === WebSocket.OPEN) {
          const now = new Date();
          const lastPing = new Date(client.lastPing);
          const timeSinceLastPing = now.getTime() - lastPing.getTime();

          if (timeSinceLastPing > this.config.heartbeatTimeout!) {
            console.log(`Closing inactive connection: ${clientId}`);
            client.socket.terminate();
            this.clients.delete(clientId);
          } else {
            client.socket.ping();
          }
        } else {
          this.clients.delete(clientId);
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    let agentSubs = 0;
    let crewSubs = 0;

    this.clients.forEach(client => {
      agentSubs += client.subscriptions.agents.size;
      crewSubs += client.subscriptions.crews.size;
    });

    return {
      totalConnections: this.stats.connections,
      activeConnections: this.clients.size,
      agentSubscriptions: agentSubs,
      crewSubscriptions: crewSubs,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      uptime: Date.now() - this.stats.startTime
    };
  }

  /**
   * Close WebSocket server
   */
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.clients.forEach(client => {
      client.socket.close();
    });

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}