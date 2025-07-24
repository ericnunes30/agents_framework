import { StreamingManager, StreamSubscription } from '../../src/websocket/StreamingManager.js';
import { PubSubManager, PubSubMessage } from '../../src/websocket/PubSubManager.js';
import { WebSocketClient } from '../../src/websocket/types.js';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

// Create a proper mock for PubSubManager that extends EventEmitter
class MockPubSubManager extends EventEmitter {
  subscribe = jest.fn().mockResolvedValue(undefined);
  unsubscribe = jest.fn().mockResolvedValue(undefined);
}

// Mock WebSocket
jest.mock('ws');
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('StreamingManager', () => {
  let mockPubSubManager: jest.Mocked<PubSubManager>;
  let streamingManager: StreamingManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked PubSubManager instance with EventEmitter behavior
    mockPubSubManager = {
      on: jest.fn(),
      emit: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined)
    } as any;

    streamingManager = new StreamingManager(mockPubSubManager);
  });

  describe('constructor', () => {
    it('should setup PubSub message listener', () => {
      expect(mockPubSubManager.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('addClient', () => {
    it('should add client to internal map', () => {
      const mockClient: WebSocketClient = {
        id: 'client-123',
        socket: { readyState: WebSocket.OPEN } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(1);
    });

    it('should handle multiple clients', () => {
      const client1: WebSocketClient = {
        id: 'client-1',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      const client2: WebSocketClient = {
        id: 'client-2',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-1', client1);
      streamingManager.addClient('client-2', client2);

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(2);
    });
  });

  describe('removeClient', () => {
    let mockClient: WebSocketClient;

    beforeEach(async () => {
      mockClient = {
        id: 'client-123',
        socket: { 
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);

      // Setup subscriptions
      mockPubSubManager.subscribe.mockResolvedValue();
      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');
    });

    it('should remove client and its subscriptions', () => {
      mockPubSubManager.unsubscribe.mockResolvedValue();

      streamingManager.removeClient('client-123');

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.executionSubscriptions).toBe(0);
    });

    it('should unsubscribe from PubSub when no more clients', () => {
      mockPubSubManager.unsubscribe.mockResolvedValue();

      streamingManager.removeClient('client-123');

      expect(mockPubSubManager.unsubscribe).toHaveBeenCalledWith('execution:exec-456');
    });

    it('should handle removing non-existent client', () => {
      const initialStats = streamingManager.getSubscriptionStats();
      const initialCount = initialStats.totalClients;

      streamingManager.removeClient('nonexistent');

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(initialCount); // No change in client count
    });
  });

  describe('subscribeToExecution', () => {
    let mockClient: WebSocketClient;

    beforeEach(() => {
      mockClient = {
        id: 'client-123',
        socket: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);
    });

    it('should subscribe client to execution updates', async () => {
      mockPubSubManager.subscribe.mockResolvedValue();

      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');

      expect(mockPubSubManager.subscribe).toHaveBeenCalledWith('execution:exec-456');
      
      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalSubscriptions).toBe(1);
      expect(stats.executionSubscriptions).toBe(1);

      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscription_confirmed"')
      );
    });

    it('should handle multiple subscriptions for same execution', async () => {
      const client2: WebSocketClient = {
        id: 'client-456',
        socket: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-456', client2);
      mockPubSubManager.subscribe.mockResolvedValue();

      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');
      await streamingManager.subscribeToExecution('client-456', 'exec-456', 'crew');

      expect(mockPubSubManager.subscribe).toHaveBeenCalledTimes(2); // Called for each client type (agent and crew)
      
      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalSubscriptions).toBe(2);
      expect(stats.executionSubscriptions).toBe(1); // Same execution
    });

    it('should send confirmation message to client', async () => {
      mockPubSubManager.subscribe.mockResolvedValue();

      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');

      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"executionId":"exec-456"')
      );
      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"agent"')
      );
    });

    it('should handle subscription to different execution types', async () => {
      mockPubSubManager.subscribe.mockResolvedValue();

      await streamingManager.subscribeToExecution('client-123', 'agent-123', 'agent');
      await streamingManager.subscribeToExecution('client-123', 'crew-456', 'crew');

      expect(mockPubSubManager.subscribe).toHaveBeenCalledWith('execution:agent-123');
      expect(mockPubSubManager.subscribe).toHaveBeenCalledWith('execution:crew-456');
      expect(mockClient.socket.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribeFromExecution', () => {
    let mockClient: WebSocketClient;

    beforeEach(async () => {
      mockClient = {
        id: 'client-123',
        socket: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);
      mockPubSubManager.subscribe.mockResolvedValue();
      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');
    });

    it('should unsubscribe client from execution', async () => {
      mockPubSubManager.unsubscribe.mockResolvedValue();

      await streamingManager.unsubscribeFromExecution('client-123', 'exec-456');

      expect(mockPubSubManager.unsubscribe).toHaveBeenCalledWith('execution:exec-456');
      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"subscription_cancelled"')
      );

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.executionSubscriptions).toBe(0);
    });

    it('should not unsubscribe from PubSub if other clients subscribed', async () => {
      // Add another client subscription
      const client2: WebSocketClient = {
        id: 'client-456',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-456', client2);
      await streamingManager.subscribeToExecution('client-456', 'exec-456', 'crew');

      mockPubSubManager.unsubscribe.mockResolvedValue();

      await streamingManager.unsubscribeFromExecution('client-123', 'exec-456');

      expect(mockPubSubManager.unsubscribe).not.toHaveBeenCalled();
    });

    it('should handle unsubscribing from non-existent subscription', async () => {
      await streamingManager.unsubscribeFromExecution('client-123', 'nonexistent');

      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"executionId":"nonexistent"')
      );
    });
  });

  describe('handlePubSubMessage', () => {
    let mockClient: WebSocketClient;
    let messageHandler: Function;

    beforeEach(async () => {
      mockClient = {
        id: 'client-123',
        socket: {
          readyState: WebSocket.OPEN,
          send: jest.fn()
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);
      mockPubSubManager.subscribe.mockResolvedValue();
      await streamingManager.subscribeToExecution('client-123', 'exec-456', 'agent');

      // Get the message handler from the constructor call
      expect(mockPubSubManager.on).toHaveBeenCalledWith('message', expect.any(Function));
      const handlerCall = mockPubSubManager.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      );
      messageHandler = handlerCall?.[1] as Function;
    });

    it('should forward execution updates to subscribed clients', () => {
      const pubSubMessage: PubSubMessage = {
        type: 'execution_update',
        entityId: 'exec-456',
        data: {
          status: 'running',
          progress: 0.5,
          currentStep: 'processing'
        },
        timestamp: new Date()
      };

      messageHandler('execution:exec-456', pubSubMessage);

      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"execution_progress"')
      );
      expect(mockClient.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"executionId":"exec-456"')
      );
    });

    it('should not forward messages to non-subscribed clients', () => {
      const pubSubMessage: PubSubMessage = {
        type: 'execution_update',
        entityId: 'other-exec',
        data: { status: 'running' },
        timestamp: new Date()
      };

      messageHandler('execution:other-exec', pubSubMessage);

      // Should not send since client not subscribed to 'other-exec'
      expect(mockClient.socket.send).toHaveBeenCalledTimes(1); // Only the initial subscription confirmation
    });

    it('should handle messages for non-execution channels', () => {
      const pubSubMessage: PubSubMessage = {
        type: 'system_update',
        entityId: 'system',
        data: { message: 'System update' },
        timestamp: new Date()
      };

      messageHandler('system:updates', pubSubMessage);

      // Should not send execution progress for non-execution channels
      expect(mockClient.socket.send).toHaveBeenCalledTimes(1); // Only the initial subscription confirmation
    });
  });

  describe('broadcastSystemUpdate', () => {
    it('should broadcast to all connected clients', () => {
      const client1: WebSocketClient = {
        id: 'client-1',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      const client2: WebSocketClient = {
        id: 'client-2',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-1', client1);
      streamingManager.addClient('client-2', client2);

      const updateData = { message: 'System maintenance', level: 'warning' };
      streamingManager.broadcastSystemUpdate(updateData);

      expect(client1.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"system_update"')
      );
      expect(client2.socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"system_update"')
      );
    });

    it('should skip clients with closed connections', () => {
      const activeClient: WebSocketClient = {
        id: 'active',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      const closedClient: WebSocketClient = {
        id: 'closed',
        socket: { readyState: WebSocket.CLOSED, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('active', activeClient);
      streamingManager.addClient('closed', closedClient);

      streamingManager.broadcastSystemUpdate({ message: 'Test' });

      expect(activeClient.socket.send).toHaveBeenCalled();
      expect(closedClient.socket.send).not.toHaveBeenCalled();
    });

    it('should handle send errors gracefully', () => {
      const faultyClient: WebSocketClient = {
        id: 'faulty',
        socket: {
          readyState: WebSocket.OPEN,
          send: jest.fn().mockImplementation(() => {
            throw new Error('Send failed');
          })
        } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      streamingManager.addClient('faulty', faultyClient);
      streamingManager.broadcastSystemUpdate({ message: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to broadcast to client faulty:',
        expect.any(Error)
      );

      // Client should be removed after error
      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return correct statistics', async () => {
      const client1: WebSocketClient = {
        id: 'client-1',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      const client2: WebSocketClient = {
        id: 'client-2',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-1', client1);
      streamingManager.addClient('client-2', client2);

      mockPubSubManager.subscribe.mockResolvedValue();
      await streamingManager.subscribeToExecution('client-1', 'exec-1', 'agent');
      await streamingManager.subscribeToExecution('client-1', 'exec-2', 'crew');
      await streamingManager.subscribeToExecution('client-2', 'exec-1', 'agent');

      const stats = streamingManager.getSubscriptionStats();

      expect(stats).toEqual({
        totalClients: 2,
        totalSubscriptions: 3,
        executionSubscriptions: 2 // exec-1 and exec-2
      });
    });

    it('should return zero stats when no clients', () => {
      const stats = streamingManager.getSubscriptionStats();

      expect(stats).toEqual({
        totalClients: 0,
        totalSubscriptions: 0,
        executionSubscriptions: 0
      });
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from all PubSub channels and clear data', async () => {
      const mockClient: WebSocketClient = {
        id: 'client-123',
        socket: { readyState: WebSocket.OPEN, send: jest.fn() } as any,
        subscriptions: { agents: new Set(), crews: new Set() },
        connectedAt: new Date(),
        lastPing: new Date()
      };

      streamingManager.addClient('client-123', mockClient);
      mockPubSubManager.subscribe.mockResolvedValue();
      mockPubSubManager.unsubscribe.mockResolvedValue();

      await streamingManager.subscribeToExecution('client-123', 'exec-1', 'agent');
      await streamingManager.subscribeToExecution('client-123', 'exec-2', 'crew');

      await streamingManager.cleanup();

      expect(mockPubSubManager.unsubscribe).toHaveBeenCalledWith('execution:exec-1');
      expect(mockPubSubManager.unsubscribe).toHaveBeenCalledWith('execution:exec-2');

      const stats = streamingManager.getSubscriptionStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.executionSubscriptions).toBe(0);
    });

    it('should handle cleanup when no subscriptions exist', async () => {
      await streamingManager.cleanup();

      expect(mockPubSubManager.unsubscribe).not.toHaveBeenCalled();
    });
  });
});