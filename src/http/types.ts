export interface ExecutionRequest {
  configPath: string;
  task?: string;
  input?: string;
  context?: Record<string, any>;
  options?: ExecutionOptions;
}

export interface ExecutionOptions {
  streaming?: boolean;
  timeout?: number;
  maxIterations?: number;
  ttl?: number;
}

export interface ExecutionResponse {
  executionId: string;
  status: 'started' | 'queued' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  message?: string;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  currentStep?: string;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  metadata?: ExecutionMetadata;
}

export interface ExecutionMetadata {
  configPath: string;
  task?: string;
  input?: string;
  tokensUsed?: number;
  executionTime?: number;
  agentId?: string;
  crewId?: string;
}

export interface ExecutionResult {
  executionId: string;
  result: any;
  metadata: ExecutionMetadata;
  tokensUsed?: number;
  executionTime: number;
  completedAt: Date;
}

export interface SystemStats {
  activeExecutions: number;
  completedToday: number;
  totalExecutions: number;
  redisMemory: string;
  uptime: number;
  connections: number;
}

export interface RedisInfo {
  connected: boolean;
  keys: number;
  memory: string;
  connections: number;
  version: string;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface APIError {
  error: string;
  code?: string;
  details?: any;
  timestamp: Date;
}