import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { 
  AgentState, 
  CrewState, 
  TaskResult, 
  StateEvent, 
  StateQueryOptions, 
  SystemStats, 
  HealthCheckResult,
  StateConfig 
} from './types';

/**
 * Redis-backed state manager for agent and crew states
 */
export class StateManager extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private connected: boolean = false;
  private config: StateConfig;

  constructor(
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    config: StateConfig = {}
  ) {
    super();
    
    this.config = {
      ttl: 3600, // 1 hour default TTL
      enableCompression: false,
      maxStateSize: 1024 * 1024, // 1MB max state size
      ...config
    };

    // Main Redis connection for operations
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Separate connections for pub/sub
    this.subscriber = new Redis(redisUrl, { lazyConnect: true });
    this.publisher = new Redis(redisUrl, { lazyConnect: true });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.connected = true;
      this.emit('connected');
    });

    this.redis.on('error', (error) => {
      this.connected = false;
      this.emit('error', error);
    });

    this.redis.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    // Subscribe to state updates
    this.subscriber.subscribe('state:updates');
    this.subscriber.on('message', (channel, message) => {
      try {
        const event: StateEvent = JSON.parse(message);
        this.emit('state:update', event);
      } catch (error) {
        console.error('Failed to parse state update:', error);
      }
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      if (!this.redis.status || this.redis.status === 'end') {
        await this.redis.connect();
      }
      if (!this.subscriber.status || this.subscriber.status === 'end') {
        await this.subscriber.connect();
      }
      if (!this.publisher.status || this.publisher.status === 'end') {
        await this.publisher.connect();
      }
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Save agent state to Redis
   */
  async saveAgentState(agentId: string, state: AgentState): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const key = `agent:${agentId}:state`;
    const serialized = JSON.stringify(state);
    
    if (serialized.length > this.config.maxStateSize!) {
      throw new Error(`Agent state too large: ${serialized.length} bytes`);
    }

    await this.redis.setex(key, this.config.ttl!, serialized);
    
    // Publish state update
    const event: StateEvent = {
      type: 'state_updated',
      entityId: agentId,
      entityType: 'agent',
      data: state,
      timestamp: new Date()
    };
    
    await this.publishStateUpdate(event);
  }

  /**
   * Get agent state from Redis
   */
  async getAgentState(agentId: string): Promise<AgentState | null> {
    if (!this.connected) {
      return null;
    }

    const key = `agent:${agentId}:state`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse agent state:', error);
      return null;
    }
  }

  /**
   * Save crew state to Redis
   */
  async saveCrewState(crewId: string, state: CrewState): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const key = `crew:${crewId}:state`;
    const serialized = JSON.stringify(state);
    
    if (serialized.length > this.config.maxStateSize!) {
      throw new Error(`Crew state too large: ${serialized.length} bytes`);
    }

    await this.redis.setex(key, this.config.ttl!, serialized);
    
    // Publish state update
    const event: StateEvent = {
      type: 'state_updated',
      entityId: crewId,
      entityType: 'crew',
      data: state,
      timestamp: new Date()
    };
    
    await this.publishStateUpdate(event);
  }

  /**
   * Get crew state from Redis
   */
  async getCrewState(crewId: string): Promise<CrewState | null> {
    if (!this.connected) {
      return null;
    }

    const key = `crew:${crewId}:state`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse crew state:', error);
      return null;
    }
  }

  /**
   * Save task result
   */
  async saveTaskResult(taskId: string, result: TaskResult): Promise<void> {
    const key = `task:${taskId}:result`;
    await this.redis.setex(key, this.config.ttl!, JSON.stringify(result));
  }

  /**
   * Get task result
   */
  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    const key = `task:${taskId}:result`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse task result:', error);
      return null;
    }
  }

  /**
   * Add task to crew queue
   */
  async enqueueTask(crewId: string, task: any): Promise<void> {
    const key = `crew:${crewId}:queue`;
    await this.redis.lpush(key, JSON.stringify(task));
  }

  /**
   * Get next task from crew queue
   */
  async dequeueTask(crewId: string): Promise<any | null> {
    const key = `crew:${crewId}:queue`;
    const data = await this.redis.rpop(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse task:', error);
      return null;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    if (!this.connected) {
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalCrews: 0,
        activeCrews: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalTokensUsed: 0,
        estimatedTotalCost: 0,
        uptime: 0
      };
    }

    // Get all keys for agents and crews
    const agentKeys = await this.redis.keys('agent:*:state');
    const crewKeys = await this.redis.keys('crew:*:state');
    const taskKeys = await this.redis.keys('task:*:result');

    let totalTokens = 0;
    let totalCost = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    // Process agent states
    const agents = await Promise.all(
      agentKeys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    // Process crew states
    const crews = await Promise.all(
      crewKeys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    // Process task results
    const tasks = await Promise.all(
      taskKeys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    tasks.forEach(task => {
      if (task) {
        totalTokens += task.metadata?.tokensUsed || 0;
        totalCost += task.metadata?.cost || 0;
        
        if (task.status === 'success') {
          completedTasks++;
        } else if (task.status === 'error') {
          failedTasks++;
        }
      }
    });

    const activeAgents = agents.filter((agent) => agent?.status === 'running').length;
    const activeCrews = crews.filter((crew) => crew?.status === 'running').length;

    return {
      totalAgents: agents.length,
      activeAgents,
      totalCrews: crews.length,
      activeCrews,
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      totalTokensUsed: totalTokens,
      estimatedTotalCost: totalCost,
      uptime: Date.now()
    };
  }

  /**
   * Query agent states with filters
   */
  async queryAgentStates(options: StateQueryOptions = {}): Promise<AgentState[]> {
    const keys = await this.redis.keys('agent:*:state');
    
    if (keys.length === 0) {
      return [];
    }

    const states = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    let filtered = states.filter(Boolean) as AgentState[];

    // Apply status filter
    if (options.statuses?.length) {
      filtered = filtered.filter(state => options.statuses!.includes(state.status));
    }

    // Apply sorting
    if (options.sortBy) {
      filtered.sort((a, b) => {
        const aVal = options.sortBy === 'created' ? a.startTime : a.endTime;
        const bVal = options.sortBy === 'created' ? b.startTime : b.endTime;
        
        const comparison = new Date(aVal || 0).getTime() - new Date(bVal || 0).getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    if (options.limit) {
      const offset = options.offset || 0;
      filtered = filtered.slice(offset, offset + options.limit);
    }

    return filtered;
  }

  /**
   * Query crew states with filters
   */
  async queryCrewStates(options: StateQueryOptions = {}): Promise<CrewState[]> {
    const keys = await this.redis.keys('crew:*:state');
    
    if (keys.length === 0) {
      return [];
    }

    const states = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    let filtered = states.filter(Boolean) as CrewState[];

    // Apply status filter
    if (options.statuses?.length) {
      filtered = filtered.filter(state => options.statuses!.includes(state.status));
    }

    // Apply sorting
    if (options.sortBy) {
      filtered.sort((a, b) => {
        const aVal = options.sortBy === 'created' ? a.startTime : a.endTime;
        const bVal = options.sortBy === 'created' ? b.startTime : b.endTime;
        
        const comparison = new Date(aVal || 0).getTime() - new Date(bVal || 0).getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    if (options.limit) {
      const offset = options.offset || 0;
      filtered = filtered.slice(offset, offset + options.limit);
    }

    return filtered;
  }

  /**
   * Publish state update
   */
  private async publishStateUpdate(event: StateEvent): Promise<void> {
    await this.publisher.publish('state:updates', JSON.stringify(event));
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await this.redis.ping();
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        redis: {
          status: 'connected',
          latency
        },
        memory: {
          usage: process.memoryUsage().heapUsed,
          limit: process.memoryUsage().heapTotal
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        redis: {
          status: 'disconnected'
        },
        memory: {
          usage: process.memoryUsage().heapUsed,
          limit: process.memoryUsage().heapTotal
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Clear all state data (use with caution)
   */
  async clearAll(): Promise<void> {
    const keys = await this.redis.keys('agent:*');
    const crewKeys = await this.redis.keys('crew:*');
    const taskKeys = await this.redis.keys('task:*');
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    if (crewKeys.length > 0) {
      await this.redis.del(...crewKeys);
    }
    
    if (taskKeys.length > 0) {
      await this.redis.del(...taskKeys);
    }
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
  }
}