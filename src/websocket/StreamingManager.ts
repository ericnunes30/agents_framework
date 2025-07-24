import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { WebSocketMessage, WebSocketClient } from './types.js';
import { PubSubManager, PubSubMessage } from './PubSubManager.js';

export interface StreamSubscription {
  clientId: string;
  executionId: string;
  type: 'agent' | 'crew';
  startTime: Date;
}

export class StreamingManager extends EventEmitter {
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, StreamSubscription[]> = new Map();
  private pubSubManager: PubSubManager;

  constructor(pubSubManager: PubSubManager) {
    super();
    this.pubSubManager = pubSubManager;
    this.setupPubSubListeners();
  }

  private setupPubSubListeners(): void {
    this.pubSubManager.on('message', (channel: string, message: PubSubMessage) => {
      this.handlePubSubMessage(channel, message);
    });
  }

  addClient(clientId: string, client: WebSocketClient): void {
    this.clients.set(clientId, client);
  }

  removeClient(clientId: string): void {
    // Remove all subscriptions for this client
    for (const [executionId, subs] of this.subscriptions.entries()) {
      const filtered = subs.filter(sub => sub.clientId !== clientId);
      if (filtered.length === 0) {
        this.subscriptions.delete(executionId);
        // Unsubscribe from PubSub channel if no more clients
        this.pubSubManager.unsubscribe(`execution:${executionId}`);
      } else {
        this.subscriptions.set(executionId, filtered);
      }
    }
    
    this.clients.delete(clientId);
  }

  async subscribeToExecution(
    clientId: string,
    executionId: string,
    type: 'agent' | 'crew'
  ): Promise<void> {
    const subscription: StreamSubscription = {
      clientId,
      executionId,
      type,
      startTime: new Date()
    };

    // Add to subscriptions
    const existing = this.subscriptions.get(executionId) || [];
    existing.push(subscription);
    this.subscriptions.set(executionId, existing);

    // Subscribe to PubSub channel
    await this.pubSubManager.subscribe(`execution:${executionId}`);

    // Send confirmation to client
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: {
        executionId,
        type,
        message: `Subscribed to ${type} execution: ${executionId}`
      },
      timestamp: new Date()
    });

    console.log(`Client ${clientId} subscribed to ${type} execution: ${executionId}`);
  }

  async unsubscribeFromExecution(clientId: string, executionId: string): Promise<void> {
    const existing = this.subscriptions.get(executionId) || [];
    const filtered = existing.filter(sub => sub.clientId !== clientId);
    
    if (filtered.length === 0) {
      this.subscriptions.delete(executionId);
      await this.pubSubManager.unsubscribe(`execution:${executionId}`);
    } else {
      this.subscriptions.set(executionId, filtered);
    }

    // Send confirmation to client
    this.sendToClient(clientId, {
      type: 'subscription_cancelled',
      data: {
        executionId,
        message: `Unsubscribed from execution: ${executionId}`
      },
      timestamp: new Date()
    });

    console.log(`Client ${clientId} unsubscribed from execution: ${executionId}`);
  }

  private handlePubSubMessage(channel: string, message: PubSubMessage): void {
    if (channel.startsWith('execution:')) {
      const executionId = channel.replace('execution:', '');
      const subscriptions = this.subscriptions.get(executionId) || [];

      for (const subscription of subscriptions) {
        this.sendExecutionUpdate(subscription.clientId, message);
      }
    }
  }

  private sendExecutionUpdate(clientId: string, message: PubSubMessage): void {
    const wsMessage: WebSocketMessage = {
      type: 'execution_progress',
      data: {
        executionId: message.entityId,
        status: message.data.status,
        progress: message.data.progress,
        currentStep: message.data.currentStep,
        result: message.data.result,
        error: message.data.error,
        timestamp: message.timestamp
      },
      timestamp: new Date()
    };

    this.sendToClient(clientId, wsMessage);
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  broadcastSystemUpdate(data: any): void {
    const message: WebSocketMessage = {
      type: 'system_update',
      data,
      timestamp: new Date()
    };

    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to broadcast to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  getSubscriptionStats(): {
    totalClients: number;
    totalSubscriptions: number;
    executionSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.length;
    }

    return {
      totalClients: this.clients.size,
      totalSubscriptions,
      executionSubscriptions: this.subscriptions.size
    };
  }

  async cleanup(): Promise<void> {
    // Unsubscribe from all PubSub channels
    for (const executionId of this.subscriptions.keys()) {
      await this.pubSubManager.unsubscribe(`execution:${executionId}`);
    }
    
    this.subscriptions.clear();
    this.clients.clear();
  }
}