/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'subscribe_agent'
  | 'subscribe_crew'
  | 'unsubscribe_agent'
  | 'unsubscribe_crew'
  | 'subscribe_execution'
  | 'unsubscribe_execution'
  | 'agent_update'
  | 'crew_update'
  | 'task_update'
  | 'execution_progress'
  | 'subscription_confirmed'
  | 'subscription_cancelled'
  | 'system_update'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: Date;
  id?: string;
}

/**
 * WebSocket client connection
 */
export interface WebSocketClient {
  id: string;
  socket: any;
  subscriptions: {
    agents: Set<string>;
    crews: Set<string>;
  };
  connectedAt: Date;
  lastPing: Date;
}

/**
 * Subscription request
 */
export interface SubscriptionRequest {
  type: 'subscribe_agent' | 'subscribe_crew' | 'unsubscribe_agent' | 'unsubscribe_crew';
  entityId: string;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  exclude?: string[];
  include?: string[];
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  agentSubscriptions: number;
  crewSubscriptions: number;
  messagesSent: number;
  messagesReceived: number;
  uptime: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxConnections: number;
  maxSubscriptions: number;
  maxMessages: number;
  windowMs: number;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  port?: number;
  host?: string;
  path?: string;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxPayload?: number;
  compression?: boolean;
  rateLimit?: RateLimitConfig;
}