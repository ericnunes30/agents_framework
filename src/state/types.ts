/**
 * Status of an agent execution
 */
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Status of a crew execution
 */
export type CrewStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Result of a task execution
 */
export interface TaskResult {
  id: string;
  agentId: string;
  taskId: string;
  output: string;
  metadata: {
    tokensUsed: number;
    model: string;
    provider: string;
    duration: number;
    timestamp: Date;
    cost?: number;
  };
  status: 'success' | 'error' | 'cancelled';
  error?: string;
}

/**
 * State of an individual agent
 */
export interface AgentState {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  tasks: TaskResult[];
  context: Record<string, any>;
  tokensUsed: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  metrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalRuntime: number;
    averageTaskTime: number;
  };
}

/**
 * State of a crew (multi-agent system)
 */
export interface CrewState {
  id: string;
  name: string;
  status: CrewStatus;
  agents: Record<string, AgentState>;
  tasks: Record<string, TaskResult>;
  sharedContext: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  currentTask?: string;
  metrics: {
    totalAgents: number;
    completedAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalRuntime: number;
    estimatedCost: number;
  };
}

/**
 * Configuration for state persistence
 */
export interface StateConfig {
  ttl?: number;
  enableCompression?: boolean;
  maxStateSize?: number;
}

/**
 * Event types for state updates
 */
export type StateEventType = 
  | 'agent_started'
  | 'agent_completed' 
  | 'agent_failed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'crew_started'
  | 'crew_completed'
  | 'crew_failed'
  | 'state_updated';

/**
 * State update event
 */
export interface StateEvent {
  type: StateEventType;
  entityId: string;
  entityType: 'agent' | 'crew' | 'task';
  data: any;
  timestamp: Date;
}

/**
 * Query options for state retrieval
 */
export interface StateQueryOptions {
  includeTasks?: boolean;
  includeMetrics?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated' | 'status';
  sortOrder?: 'asc' | 'desc';
  statuses?: AgentStatus[] | CrewStatus[];
}

/**
 * Statistics for agents and crews
 */
export interface SystemStats {
  totalAgents: number;
  activeAgents: number;
  totalCrews: number;
  activeCrews: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTokensUsed: number;
  estimatedTotalCost: number;
  uptime: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  redis: {
    status: 'connected' | 'disconnected' | 'error';
    latency?: number;
  };
  memory: {
    usage: number;
    limit: number;
  };
  timestamp: Date;
}