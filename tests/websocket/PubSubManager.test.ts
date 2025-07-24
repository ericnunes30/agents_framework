import { PubSubManager, PubSubMessage } from '../../src/websocket/PubSubManager.js';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('PubSubManager', () => {
  let mockSubscriber: jest.Mocked<Redis>;
  let mockPublisher: jest.Mocked<Redis>;
  let pubSubManager: PubSubManager;

  beforeEach(() => {
    // Create mocked Redis instances
    mockSubscriber = {
      on: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    mockPublisher = {
      publish: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockSubscriber);

    jest.clearAllMocks();
    
    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    pubSubManager = new PubSubManager(mockSubscriber, mockPublisher);
  });

  describe('constructor', () => {
    it('should setup subscriber listeners', () => {
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('subscribe', () => {
    it('should subscribe to new channel', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);

      await pubSubManager.subscribe('test:channel');

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('test:channel');
      expect(pubSubManager.getSubscribedChannels()).toContain('test:channel');
    });

    it('should not subscribe to already subscribed channel', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);

      // Subscribe first time
      await pubSubManager.subscribe('test:channel');
      
      // Subscribe second time
      await pubSubManager.subscribe('test:channel');

      expect(mockSubscriber.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should handle subscription errors', async () => {
      const error = new Error('Subscription failed');
      mockSubscriber.subscribe.mockRejectedValue(error);

      await expect(pubSubManager.subscribe('test:channel')).rejects.toThrow('Subscription failed');
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);
      await pubSubManager.subscribe('test:channel');
    });

    it('should unsubscribe from subscribed channel', async () => {
      mockSubscriber.unsubscribe.mockResolvedValue(1);

      await pubSubManager.unsubscribe('test:channel');

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('test:channel');
      expect(pubSubManager.getSubscribedChannels()).not.toContain('test:channel');
    });

    it('should not unsubscribe from non-subscribed channel', async () => {
      await pubSubManager.unsubscribe('nonexistent:channel');

      expect(mockSubscriber.unsubscribe).not.toHaveBeenCalled();
    });

    it('should handle unsubscription errors', async () => {
      const error = new Error('Unsubscription failed');
      mockSubscriber.unsubscribe.mockRejectedValue(error);

      await expect(pubSubManager.unsubscribe('test:channel')).rejects.toThrow('Unsubscription failed');
    });
  });

  describe('publish', () => {
    it('should publish message to channel', async () => {
      const message: PubSubMessage = {
        type: 'agent_update',
        entityId: 'agent-123',
        data: { status: 'running' },
        timestamp: new Date()
      };

      mockPublisher.publish.mockResolvedValue(1);

      await pubSubManager.publish('test:channel', message);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'test:channel',
        JSON.stringify(message)
      );
    });

    it('should handle publish errors', async () => {
      const message: PubSubMessage = {
        type: 'agent_update',
        entityId: 'agent-123',
        data: { status: 'running' },
        timestamp: new Date()
      };

      const error = new Error('Publish failed');
      mockPublisher.publish.mockRejectedValue(error);

      await expect(pubSubManager.publish('test:channel', message)).rejects.toThrow('Publish failed');
    });
  });

  describe('publishExecutionUpdate', () => {
    it('should publish execution update to specific and global channels', async () => {
      mockPublisher.publish.mockResolvedValue(1);

      await pubSubManager.publishExecutionUpdate(
        'exec-123',
        'running',
        0.5,
        { currentStep: 'processing' }
      );

      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'execution:exec-123',
        expect.stringContaining('"type":"execution_update"')
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'executions:all',
        expect.stringContaining('"type":"execution_update"')
      );

      const publishedMessage = JSON.parse(mockPublisher.publish.mock.calls[0][1] as string);
      expect(publishedMessage).toMatchObject({
        type: 'execution_update',
        entityId: 'exec-123',
        data: {
          status: 'running',
          progress: 0.5,
          currentStep: 'processing'
        }
      });
    });
  });

  describe('publishAgentUpdate', () => {
    it('should publish agent update to specific and global channels', async () => {
      mockPublisher.publish.mockResolvedValue(1);

      const agentData = { status: 'running', progress: 0.75 };
      await pubSubManager.publishAgentUpdate('agent-123', agentData);

      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'agent:agent-123',
        expect.stringContaining('"type":"agent_update"')
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'agents:all',
        expect.stringContaining('"type":"agent_update"')
      );

      const publishedMessage = JSON.parse(mockPublisher.publish.mock.calls[0][1] as string);
      expect(publishedMessage).toMatchObject({
        type: 'agent_update',
        entityId: 'agent-123',
        data: agentData
      });
    });
  });

  describe('publishCrewUpdate', () => {
    it('should publish crew update to specific and global channels', async () => {
      mockPublisher.publish.mockResolvedValue(1);

      const crewData = { status: 'running', currentTask: 'task-2' };
      await pubSubManager.publishCrewUpdate('crew-456', crewData);

      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'crew:crew-456',
        expect.stringContaining('"type":"crew_update"')
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'crews:all',
        expect.stringContaining('"type":"crew_update"')
      );

      const publishedMessage = JSON.parse(mockPublisher.publish.mock.calls[0][1] as string);
      expect(publishedMessage).toMatchObject({
        type: 'crew_update',
        entityId: 'crew-456',
        data: crewData
      });
    });
  });

  describe('publishSystemUpdate', () => {
    it('should publish system update', async () => {
      mockPublisher.publish.mockResolvedValue(1);

      const systemData = { message: 'System maintenance in 5 minutes', level: 'warning' };
      await pubSubManager.publishSystemUpdate(systemData);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'system:updates',
        expect.stringContaining('"type":"system_update"')
      );

      const publishedMessage = JSON.parse(mockPublisher.publish.mock.calls[0][1] as string);
      expect(publishedMessage).toMatchObject({
        type: 'system_update',
        entityId: 'system',
        data: systemData
      });
    });
  });

  describe('message handling', () => {
    it('should emit parsed message when valid JSON received', () => {
      const message: PubSubMessage = {
        type: 'agent_update',
        entityId: 'agent-123',
        data: { status: 'completed' },
        timestamp: new Date()
      };

      const emitSpy = jest.spyOn(pubSubManager, 'emit');

      // Find the message handler that was registered
      const messageCall = mockSubscriber.on.mock.calls.find(call => call[0] === 'message');
      expect(messageCall).toBeDefined();
      
      const messageHandler = messageCall![1];
      
      // Directly call the handler to simulate Redis message
      messageHandler('test:channel', JSON.stringify(message));

      expect(emitSpy).toHaveBeenCalledWith('message', 'test:channel', {
        ...message,
        timestamp: message.timestamp.toISOString()
      });
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const emitSpy = jest.spyOn(pubSubManager, 'emit');

      // Find and call the message handler with invalid JSON
      const messageCall = mockSubscriber.on.mock.calls.find(call => call[0] === 'message');
      expect(messageCall).toBeDefined();
      
      const messageHandler = messageCall![1];
      messageHandler('test:channel', 'invalid-json');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse PubSub message:',
        expect.any(Error)
      );
      expect(emitSpy).not.toHaveBeenCalledWith('message');

      consoleSpy.mockRestore();
    });

    it('should emit subscriber errors', (done) => {
      const error = new Error('Redis connection error');
      
      // Set up listener for the error event
      pubSubManager.on('error', (receivedError) => {
        expect(receivedError).toBe(error);
        done();
      });

      // Find and call the error handler
      const errorCall = mockSubscriber.on.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();
      
      if (errorCall) {
        const errorHandler = errorCall[1];
        errorHandler(error);
      }
    });
  });

  describe('getSubscribedChannels', () => {
    it('should return empty array initially', () => {
      const channels = pubSubManager.getSubscribedChannels();
      expect(channels).toEqual([]);
    });

    it('should return subscribed channels', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);

      await pubSubManager.subscribe('channel-1');
      await pubSubManager.subscribe('channel-2');

      const channels = pubSubManager.getSubscribedChannels();
      expect(channels).toContain('channel-1');
      expect(channels).toContain('channel-2');
      expect(channels).toHaveLength(2);
    });
  });

  describe('close', () => {
    it('should unsubscribe from all channels', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);
      mockSubscriber.unsubscribe.mockResolvedValue(1);

      // Subscribe to multiple channels
      await pubSubManager.subscribe('channel-1');
      await pubSubManager.subscribe('channel-2');

      await pubSubManager.close();

      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('channel-1');
      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('channel-2');
      expect(pubSubManager.getSubscribedChannels()).toHaveLength(0);
    });

    it('should handle close when no subscriptions', async () => {
      await pubSubManager.close();

      expect(mockSubscriber.unsubscribe).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe errors during close', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);
      mockSubscriber.unsubscribe.mockRejectedValue(new Error('Unsubscribe failed'));

      await pubSubManager.subscribe('channel-1');

      // Should throw the unsubscribe error since close doesn't handle it
      await expect(pubSubManager.close()).rejects.toThrow('Unsubscribe failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple subscribers and publishers', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);
      mockPublisher.publish.mockResolvedValue(2); // 2 subscribers

      // Subscribe to execution channel
      await pubSubManager.subscribe('execution:test-123');

      // Publish update
      await pubSubManager.publishExecutionUpdate('test-123', 'completed', 1.0);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'execution:test-123',
        expect.any(String)
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'executions:all',
        expect.any(String)
      );
    });

    it('should handle rapid subscribe/unsubscribe operations', async () => {
      mockSubscriber.subscribe.mockResolvedValue(1);
      mockSubscriber.unsubscribe.mockResolvedValue(1);

      const channel = 'rapid:test';

      // Rapid subscribe/unsubscribe
      await pubSubManager.subscribe(channel);
      await pubSubManager.unsubscribe(channel);
      await pubSubManager.subscribe(channel);

      expect(mockSubscriber.subscribe).toHaveBeenCalledTimes(2);
      expect(mockSubscriber.unsubscribe).toHaveBeenCalledTimes(1);
      expect(pubSubManager.getSubscribedChannels()).toContain(channel);
    });
  });
});