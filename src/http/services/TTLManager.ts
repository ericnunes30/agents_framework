import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface TTLConfig {
  executions: number; // Default TTL for executions (1 hour)
  configs: number;    // Default TTL for configs (24 hours)
  results: number;    // Default TTL for results (4 hours)
  stats: number;      // Default TTL for stats (1 day)
}

export class TTLManager extends EventEmitter {
  private redis: Redis;
  private config: TTLConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(redis: Redis, config: Partial<TTLConfig> = {}) {
    super();
    this.redis = redis;
    this.config = {
      executions: 3600,    // 1 hour
      configs: 86400,      // 24 hours  
      results: 14400,      // 4 hours
      stats: 86400,        // 1 day
      ...config
    };
  }

  start(intervalMs: number = 300000): void { // 5 minutes default
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('TTL cleanup error:', error);
        this.emit('error', error);
      });
    }, intervalMs);

    console.log('TTL Manager started with cleanup interval:', intervalMs);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  async setWithTTL(key: string, value: string, type: keyof TTLConfig): Promise<void> {
    const ttl = this.config[type];
    await this.redis.setex(key, ttl, value);
  }

  async extendTTL(key: string, type: keyof TTLConfig): Promise<boolean> {
    const ttl = this.config[type];
    const result = await this.redis.expire(key, ttl);
    return result === 1;
  }

  async getTTL(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  async refreshTTL(pattern: string, type: keyof TTLConfig): Promise<number> {
    const keys = await this.redis.keys(pattern);
    const ttl = this.config[type];
    let refreshed = 0;

    for (const key of keys) {
      const result = await this.redis.expire(key, ttl);
      if (result === 1) refreshed++;
    }

    return refreshed;
  }

  private async performCleanup(): Promise<void> {
    try {
      await this.cleanupExpiredKeys();
      await this.cleanupOrphanedExecutions();
      await this.updateStats();
      
      this.emit('cleanup:completed', {
        timestamp: new Date(),
        message: 'TTL cleanup completed successfully'
      });
    } catch (error) {
      this.emit('cleanup:error', error);
      throw error;
    }
  }

  private async cleanupExpiredKeys(): Promise<void> {
    // Redis automatically removes expired keys, but we can help by cleaning up references
    const activeExecutions = await this.redis.smembers('active_executions');
    const expiredExecutions = [];

    for (const executionId of activeExecutions) {
      const exists = await this.redis.exists(`executions:${executionId}`);
      if (!exists) {
        expiredExecutions.push(executionId);
      }
    }

    if (expiredExecutions.length > 0) {
      await this.redis.srem('active_executions', ...expiredExecutions);
      console.log(`Cleaned up ${expiredExecutions.length} expired execution references`);
    }
  }

  private async cleanupOrphanedExecutions(): Promise<void> {
    const activeExecutions = await this.redis.smembers('active_executions');
    const now = Date.now();
    const maxAge = this.config.executions * 1000; // Convert to milliseconds
    const orphanedExecutions = [];

    for (const executionId of activeExecutions) {
      const executionData = await this.redis.get(`executions:${executionId}`);
      if (executionData) {
        const execution = JSON.parse(executionData);
        const age = now - new Date(execution.startTime).getTime();
        
        if (age > maxAge && (execution.status === 'running' || execution.status === 'queued')) {
          // Mark as failed due to timeout
          execution.status = 'failed';
          execution.error = 'Execution timed out';
          execution.endTime = new Date();
          
          await this.redis.setex(
            `executions:${executionId}`,
            this.config.results,
            JSON.stringify(execution)
          );
          
          orphanedExecutions.push(executionId);
        }
      }
    }

    if (orphanedExecutions.length > 0) {
      await this.redis.srem('active_executions', ...orphanedExecutions);
      console.log(`Cleaned up ${orphanedExecutions.length} orphaned executions`);
    }
  }

  private async updateStats(): Promise<void> {
    const stats = {
      totalKeys: await this.redis.dbsize(),
      activeExecutions: await this.redis.scard('active_executions'),
      lastCleanup: new Date()
    };

    await this.redis.setex(
      'system:cleanup_stats',
      this.config.stats,
      JSON.stringify(stats)
    );
  }

  async getCleanupStats(): Promise<any> {
    const data = await this.redis.get('system:cleanup_stats');
    return data ? JSON.parse(data) : null;
  }

  getConfig(): TTLConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TTLConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config:updated', this.config);
  }
}