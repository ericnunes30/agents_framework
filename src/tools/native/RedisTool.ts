import { BaseTool } from '../BaseTool.js';
import Redis from 'ioredis';

/**
 * Redis operations tool
 */
export class RedisTool extends BaseTool {
  private redis: Redis;

  constructor(config: any = {}) {
    super(
      'redis',
      'Redis operations tool for data storage and retrieval',
      config
    );
    
    const redisUrl = config.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  /**
   * Execute Redis operation
   */
  async execute(parameters: any): Promise<any> {
    const { operation, key, value, ttl } = parameters;

    if (!operation) return this.createResult(false, null, 'Operation required');

    try {
      switch (operation) {
        case 'get':
          const result = await this.redis.get(key);
          return this.createResult(true, { value: result });

        case 'set':
          if (ttl) {
            await this.redis.setex(key, ttl, value);
          } else {
            await this.redis.set(key, value);
          }
          return this.createResult(true, { success: true });

        case 'del':
          const deleted = await this.redis.del(key);
          return this.createResult(true, { deleted: deleted });

        case 'exists':
          const exists = await this.redis.exists(key);
          return this.createResult(true, { exists: exists > 0 });

        case 'keys':
          const pattern = parameters.pattern || '*';
          const keys = await this.redis.keys(pattern);
          return this.createResult(true, { keys });

        case 'hget':
          const hresult = await this.redis.hget(key, parameters.field);
          return this.createResult(true, { value: hresult });

        case 'hset':
          await this.redis.hset(key, parameters.field, value);
          return this.createResult(true, { success: true });

        case 'lpush':
          const lresult = await this.redis.lpush(key, value);
          return this.createResult(true, { length: lresult });

        case 'rpop':
          const rresult = await this.redis.rpop(key);
          return this.createResult(true, { value: rresult });

        default:
          return this.createResult(false, null, `Unknown operation: ${operation}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createResult(false, null, message);
    }
  }

  /**
   * Validate input parameters
   */
  validate(parameters: any): boolean {
    if (!parameters.operation) return false;
    
    const rules = {
      get: ['key'],
      set: ['key', 'value'],
      del: ['key'],
      exists: ['key'],
      keys: ['pattern'],
      hget: ['key', 'field'],
      hset: ['key', 'field', 'value'],
      lpush: ['key', 'value'],
      rpop: ['key']
    };

    const rule = rules[parameters.operation as keyof typeof rules];
    if (!rule) return false;
    
    for (const field of rule) {
      if (!parameters[field]) return false;
    }
    
    return true;
  }

  /**
   * Get tool schema
   */
  getSchema(): any {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get', 'set', 'del', 'exists', 'keys', 'hget', 'hset', 'lpush', 'rpop'],
            description: 'Redis operation to perform'
          },
          key: {
            type: 'string',
            description: 'Redis key'
          },
          value: {
            type: 'string',
            description: 'Value to store'
          },
          field: {
            type: 'string',
            description: 'Hash field name'
          },
          pattern: {
            type: 'string',
            description: 'Pattern for keys search'
          },
          ttl: {
            type: 'number',
            description: 'Time to live in seconds'
          }
        },
        required: ['operation']
      }
    };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}