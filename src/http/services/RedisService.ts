import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { 
  ExecutionStatus, 
  ExecutionResult, 
  ExecutionMetadata, 
  SystemStats, 
  RedisInfo 
} from '../types.js';
import { PubSubManager } from '../../websocket/PubSubManager.js';

export class RedisService {
  private redis: Redis;
  private pubSubManager?: PubSubManager;

  constructor(redis: Redis, pubSubManager?: PubSubManager) {
    this.redis = redis;
    this.pubSubManager = pubSubManager;
  }

  async createExecution(
    type: 'agent' | 'crew',
    metadata: ExecutionMetadata,
    ttl: number = 3600
  ): Promise<string> {
    const executionId = `${type}_${uuidv4()}`;
    
    const execution: ExecutionStatus = {
      executionId,
      status: 'queued',
      startTime: new Date(),
      metadata
    };

    await this.redis.setex(
      `executions:${executionId}`,
      ttl,
      JSON.stringify(execution)
    );

    await this.redis.sadd('active_executions', executionId);
    await this.redis.expire('active_executions', ttl);

    return executionId;
  }

  async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus['status'],
    progress?: number,
    currentStep?: string,
    result?: any,
    error?: string
  ): Promise<void> {
    const key = `executions:${executionId}`;
    const executionData = await this.redis.get(key);
    
    if (!executionData) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const execution: ExecutionStatus = JSON.parse(executionData);
    execution.status = status;
    execution.progress = progress;
    execution.currentStep = currentStep;
    execution.result = result;
    execution.error = error;

    if (status === 'completed' || status === 'failed') {
      execution.endTime = new Date();
      await this.redis.srem('active_executions', executionId);
    }

    const ttl = await this.redis.ttl(key);
    await this.redis.setex(key, ttl > 0 ? ttl : 3600, JSON.stringify(execution));

    // Publish update through PubSub for real-time updates
    if (this.pubSubManager) {
      await this.pubSubManager.publishExecutionUpdate(
        executionId,
        status,
        progress,
        {
          currentStep,
          result,
          error,
          metadata: execution.metadata
        }
      );
    }
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    const data = await this.redis.get(`executions:${executionId}`);
    if (!data) {
      return null;
    }
    
    const parsed = JSON.parse(data);
    // Convert string dates back to Date objects
    if (parsed.startTime) {
      parsed.startTime = new Date(parsed.startTime);
    }
    if (parsed.endTime) {
      parsed.endTime = new Date(parsed.endTime);
    }
    return parsed;
  }

  async getExecutionResult(executionId: string): Promise<ExecutionResult | null> {
    const execution = await this.getExecutionStatus(executionId);
    
    if (!execution || execution.status !== 'completed') {
      return null;
    }

    return {
      executionId,
      result: execution.result,
      metadata: execution.metadata!,
      tokensUsed: execution.metadata?.tokensUsed,
      executionTime: execution.endTime && execution.startTime 
        ? execution.endTime.getTime() - execution.startTime.getTime()
        : 0,
      completedAt: execution.endTime!
    };
  }

  async getActiveExecutions(): Promise<string[]> {
    return await this.redis.smembers('active_executions');
  }

  async cacheConfig(configPath: string, config: any, ttl: number = 86400): Promise<void> {
    const key = `configs:${Buffer.from(configPath).toString('base64')}`;
    await this.redis.setex(key, ttl, JSON.stringify(config));
  }

  async getCachedConfig(configPath: string): Promise<any | null> {
    const key = `configs:${Buffer.from(configPath).toString('base64')}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getSystemStats(): Promise<SystemStats> {
    const [
      activeExecutions,
      totalKeys,
      memoryInfo,
      uptime
    ] = await Promise.all([
      this.redis.scard('active_executions'),
      this.redis.dbsize(),
      this.redis.info('memory'),
      this.redis.time()
    ]);

    // Parse memory usage from Redis info
    const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
    const redisMemory = memoryMatch ? memoryMatch[1] : '0B';

    // Calculate completed today (simplified - would need more sophisticated tracking in production)
    const completedToday = await this.getCompletedTodayCount();

    return {
      activeExecutions,
      completedToday,
      totalExecutions: totalKeys,
      redisMemory,
      uptime: parseInt(uptime[0].toString()) * 1000000 + parseInt(uptime[1].toString()),
      connections: await this.getConnectionCount()
    };
  }

  async getRedisInfo(): Promise<RedisInfo> {
    const [info, dbsize] = await Promise.all([
      this.redis.info(),
      this.redis.dbsize()
    ]);

    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    const connectionsMatch = info.match(/connected_clients:([^\r\n]+)/);

    return {
      connected: this.redis.status === 'ready',
      keys: dbsize,
      memory: memoryMatch ? memoryMatch[1] : '0B',
      connections: connectionsMatch ? parseInt(connectionsMatch[1]) : 0,
      version: versionMatch ? versionMatch[1] : 'unknown'
    };
  }

  private async getCompletedTodayCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const count = await this.redis.get(`stats:completed:${today}`);
    return count ? parseInt(count) : 0;
  }

  private async getConnectionCount(): Promise<number> {
    const info = await this.redis.info('clients');
    const match = info.match(/connected_clients:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async incrementCompletedCount(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `stats:completed:${today}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 86400 * 2); // Keep for 2 days
  }

  async cleanup(): Promise<void> {
    const activeExecutions = await this.getActiveExecutions();
    const now = Date.now();
    
    for (const executionId of activeExecutions) {
      const execution = await this.getExecutionStatus(executionId);
      if (execution && execution.startTime) {
        const age = now - new Date(execution.startTime).getTime();
        // Clean up executions older than 1 hour that are still marked as active
        if (age > 3600000) {
          await this.redis.srem('active_executions', executionId);
        }
      } else {
        // If execution doesn't exist or has no startTime, clean it up
        await this.redis.srem('active_executions', executionId);
      }
    }
  }
}