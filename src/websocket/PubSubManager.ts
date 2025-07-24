import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { WebSocketMessage, WebSocketMessageType } from './types.js';

export interface PubSubMessage {
  type: 'agent_update' | 'crew_update' | 'execution_update' | 'system_update';
  entityId: string;
  data: any;
  timestamp: Date;
}

export class PubSubManager extends EventEmitter {
  private subscriber: Redis;
  private publisher: Redis;
  private channels: Set<string> = new Set();

  constructor(subscriber: Redis, publisher: Redis) {
    super();
    this.subscriber = subscriber;
    this.publisher = publisher;
    
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const pubSubMessage: PubSubMessage = JSON.parse(message);
        this.emit('message', channel, pubSubMessage);
      } catch (error) {
        console.error('Failed to parse PubSub message:', error);
      }
    });

    this.subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error);
      this.emit('error', error);
    });
  }

  async subscribe(channel: string): Promise<void> {
    if (!this.channels.has(channel)) {
      await this.subscriber.subscribe(channel);
      this.channels.add(channel);
      console.log(`Subscribed to channel: ${channel}`);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (this.channels.has(channel)) {
      await this.subscriber.unsubscribe(channel);
      this.channels.delete(channel);
      console.log(`Unsubscribed from channel: ${channel}`);
    }
  }

  async publish(channel: string, message: PubSubMessage): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async publishExecutionUpdate(
    executionId: string,
    status: string,
    progress?: number,
    data?: any
  ): Promise<void> {
    const message: PubSubMessage = {
      type: 'execution_update',
      entityId: executionId,
      data: {
        status,
        progress,
        timestamp: new Date(),
        ...data
      },
      timestamp: new Date()
    };

    await this.publish(`execution:${executionId}`, message);
    await this.publish('executions:all', message);
  }

  async publishAgentUpdate(agentId: string, data: any): Promise<void> {
    const message: PubSubMessage = {
      type: 'agent_update',
      entityId: agentId,
      data,
      timestamp: new Date()
    };

    await this.publish(`agent:${agentId}`, message);
    await this.publish('agents:all', message);
  }

  async publishCrewUpdate(crewId: string, data: any): Promise<void> {
    const message: PubSubMessage = {
      type: 'crew_update',
      entityId: crewId,
      data,
      timestamp: new Date()
    };

    await this.publish(`crew:${crewId}`, message);
    await this.publish('crews:all', message);
  }

  async publishSystemUpdate(data: any): Promise<void> {
    const message: PubSubMessage = {
      type: 'system_update',
      entityId: 'system',
      data,
      timestamp: new Date()
    };

    await this.publish('system:updates', message);
  }

  getSubscribedChannels(): string[] {
    return Array.from(this.channels);
  }

  async close(): Promise<void> {
    for (const channel of this.channels) {
      await this.subscriber.unsubscribe(channel);
    }
    this.channels.clear();
    
    // Note: We don't disconnect the Redis instances here as they might be shared
    // The calling code should handle Redis connection cleanup
  }
}