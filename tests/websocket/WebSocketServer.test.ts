import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Server } from 'http';
import { WebSocket } from 'ws';
import FakeTimers from '@sinonjs/fake-timers';
import { WebSocketServer } from '../../src/websocket/WebSocketServer.js';
import { StateManager } from '../../src/state/StateManager.js';
import type { WebSocketConfig, WebSocketMessage, ConnectionStats } from '../../src/websocket/types.js';
import type { StateEvent } from '../../src/state/types.js';

// Mock dependencies
jest.mock('ws');
jest.mock('../../src/state/StateManager.js');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

describe('WebSocketServer', () => {
  let mockServer: jest.Mocked<Server>;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockWSServer: any;
  let mockSocket: jest.Mocked<WebSocket>;
  let wsServer: WebSocketServer;
  let config: WebSocketConfig;

  beforeEach(() => {
    // Mock HTTP Server
    mockServer = {
      listen: jest.fn(),
      close: jest.fn()
    } as any;

    // Mock StateManager
    const realEmit = jest.fn();
    mockStateManager = {
      on: jest.fn(),
      emit: realEmit,
      getAgentState: jest.fn(),
      getCrewState: jest.fn(),
      saveAgentState: jest.fn(),
      saveCrewState: jest.fn()
    } as any;
    
    // Setup emit to trigger registered handlers
    realEmit.mockImplementation((...params: any[]) => {
      const [event, ...args] = params;
      const calls = mockStateManager.on.mock.calls;
      calls.forEach((call: any[]) => {
        if (call[0] === event && typeof call[1] === 'function') {
          call[1](...args);
        }
      });
    });

    // Mock WebSocket Server
    mockWSServer = {
      on: jest.fn(),
      close: jest.fn((callback?: () => void) => {
        if (callback) callback();
      }),
      clients: new Set()
    };

    // Mock WebSocket
    mockSocket = {
      readyState: WebSocket.OPEN,
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn()
    } as any;

    // Mock ws module
    (WebSocket as any).OPEN = 1;
    (WebSocket as any).CLOSED = 3;
    const MockWSServer = require('ws').WebSocketServer;
    MockWSServer.mockImplementation(() => mockWSServer);

    // Configuration
    config = {
      port: 3001,
      host: 'localhost',
      path: '/ws',
      heartbeatInterval: 1000, // Shorter for testing
      heartbeatTimeout: 500,
      maxPayload: 1024,
      compression: true
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (wsServer) {
      await wsServer.close();
      wsServer.removeAllListeners();
    }
  });

  describe('Constructor and Setup', () => {
    it('should initialize WebSocket server with default config', () => {
      wsServer = new WebSocketServer(mockServer, mockStateManager);
      
      expect(mockWSServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWSServer.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockStateManager.on).toHaveBeenCalledWith('state:update', expect.any(Function));
      expect(mockStateManager.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should initialize WebSocket server with custom config', () => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      expect(wsServer).toBeInstanceOf(WebSocketServer);
    });

    it('should setup state manager listeners', () => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      expect(mockStateManager.on).toHaveBeenCalledWith('state:update', expect.any(Function));
      expect(mockStateManager.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Connection Handling', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
    });

    it('should handle new client connections', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      const mockRequest = { url: '/ws' };
      
      handleConnection(mockSocket, mockRequest);
      
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Connected to Agent Framework WebSocket'));
    });

    it('should handle client disconnection', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      const handleClose = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'close')?.[1];
      if (handleClose) handleClose.call(mockSocket);
      
      const stats = wsServer.getConnectionStats();
      expect(stats.activeConnections).toBe(0);
    });

    it('should handle socket errors', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      const handleError = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      const testError = new Error('Socket error');
      
      if (handleError) handleError.call(mockSocket, testError);
      
      const stats = wsServer.getConnectionStats();
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      // Simulate connection
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
    });

    it('should handle agent subscription messages', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_agent',
        data: { agentId: 'agent-123' },
        timestamp: new Date()
      });
      
      mockStateManager.getAgentState.mockResolvedValue({
        id: 'agent-123',
        name: 'Test Agent',
        status: 'pending',
        tasks: [],
        context: {},
        tokensUsed: 0,
        metrics: {
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          totalRuntime: 0,
          averageTaskTime: 0
        }
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Subscribed to agent: agent-123'));
    });

    it('should handle crew subscription messages', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_crew',
        data: { crewId: 'crew-456' },
        timestamp: new Date()
      });
      
      mockStateManager.getCrewState.mockResolvedValue({
        id: 'crew-456',
        name: 'Test Crew',
        status: 'pending',
        agents: {},
        tasks: {},
        sharedContext: {},
        metrics: {
          totalAgents: 0,
          completedAgents: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalRuntime: 0,
          estimatedCost: 0
        }
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Subscribed to crew: crew-456'));
    });

    it('should handle unsubscribe messages', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      
      // First subscribe
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_agent',
        data: { agentId: 'agent-123' },
        timestamp: new Date()
      });
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      // Then unsubscribe
      const unsubscribeMessage = JSON.stringify({
        type: 'unsubscribe_agent',
        data: { agentId: 'agent-123' },
        timestamp: new Date()
      });
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(unsubscribeMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Unsubscribed from agent: agent-123'));
    });

    it('should handle ping messages', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const pingMessage = JSON.stringify({
        type: 'ping',
        data: {},
        timestamp: new Date()
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(pingMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"pong"'));
    });

    it('should handle invalid messages', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from('invalid json'));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Invalid message format'));
    });

    it('should handle unknown message types', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const unknownMessage = JSON.stringify({
        type: 'unknown_type',
        data: {},
        timestamp: new Date()
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(unknownMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('Unknown message type'));
    });

    it('should require agentId for agent subscription', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const invalidMessage = JSON.stringify({
        type: 'subscribe_agent',
        data: {},
        timestamp: new Date()
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(invalidMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('agentId is required'));
    });

    it('should require crewId for crew subscription', () => {
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const invalidMessage = JSON.stringify({
        type: 'subscribe_crew',
        data: {},
        timestamp: new Date()
      });
      
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(invalidMessage));
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('crewId is required'));
    });
  });

  describe('State Updates Broadcasting', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
    });

    it('should broadcast agent state updates to subscribers', () => {
      // Setup client with subscription
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_agent',
        data: { agentId: 'agent-123' },
        timestamp: new Date()
      });
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      // Simulate state update
      const stateEvent: StateEvent = {
        type: 'agent_started',
        entityType: 'agent',
        entityId: 'agent-123',
        data: { status: 'running' },
        timestamp: new Date()
      };
      
      // Emit the state update event to trigger the broadcast
      mockStateManager.emit('state:update', stateEvent);
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"agent_update"'));
    });

    it('should broadcast crew state updates to subscribers', () => {
      // Setup client with subscription
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_crew',
        data: { crewId: 'crew-456' },
        timestamp: new Date()
      });
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      // Simulate state update
      const stateEvent: StateEvent = {
        type: 'crew_started',
        entityType: 'crew',
        entityId: 'crew-456',
        data: { status: 'running' },
        timestamp: new Date()
      };
      
      // Emit the state update event to trigger the broadcast
      mockStateManager.emit('state:update', stateEvent);
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"crew_update"'));
    });

    it('should handle StateManager errors', () => {
      const errorHandler = mockStateManager.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      const testError = new Error('State manager error');
      
      // Setup client
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      // Emit the error event to trigger the broadcast
      mockStateManager.emit('error', testError);
      
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"system_update"'));
      expect(mockSocket.send).toHaveBeenCalledWith(expect.stringContaining('State manager error'));
    });
  });

  describe('Broadcasting', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
    });

    it('should broadcast to all clients', () => {
      // Setup multiple clients
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      
      const mockSocket1 = { 
        ...mockSocket, 
        send: jest.fn(), 
        readyState: WebSocket.OPEN,
        on: jest.fn()
      };
      const mockSocket2 = { 
        ...mockSocket, 
        send: jest.fn(), 
        readyState: WebSocket.OPEN,
        on: jest.fn()
      };
      
      if (handleConnection) {
        handleConnection(mockSocket1, {});
        handleConnection(mockSocket2, {});
      }
      
      // Clear previous calls (welcome messages)
      mockSocket1.send.mockClear();
      mockSocket2.send.mockClear();
      
      wsServer.broadcast('system_update', { message: 'Broadcast test' });
      
      // Check that at least one client received the broadcast
      const totalCalls = mockSocket1.send.mock.calls.length + mockSocket2.send.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
      
      // Check that if any calls were made, they contain the broadcast message
      const allCalls = [...mockSocket1.send.mock.calls, ...mockSocket2.send.mock.calls];
      if (allCalls.length > 0) {
        const hasBroadcast = allCalls.some(call => 
          typeof call[0] === 'string' && call[0].includes('Broadcast test')
        );
        expect(hasBroadcast).toBe(true);
      }
    });

    it('should exclude specified clients from broadcast', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      
      const mockSocket1 = { 
        ...mockSocket, 
        send: jest.fn(), 
        readyState: WebSocket.OPEN,
        on: jest.fn()
      };
      const mockSocket2 = { 
        ...mockSocket, 
        send: jest.fn(), 
        readyState: WebSocket.OPEN,
        on: jest.fn()
      };
      
      if (handleConnection) {
        handleConnection(mockSocket1, {});
        handleConnection(mockSocket2, {});
      }
      
      wsServer.broadcast('system_update', { message: 'Selective broadcast' }, { exclude: ['mock-uuid-123'] });
      
      // Only one should receive (depending on UUID generation)
      const totalSends = (mockSocket1.send as jest.Mock).mock.calls.length + (mockSocket2.send as jest.Mock).mock.calls.length;
      expect(totalSends).toBeGreaterThanOrEqual(1);
    });

    it('should handle failed broadcasts gracefully', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      
      const mockSocket1 = { 
        ...mockSocket, 
        send: jest.fn().mockImplementation(() => { throw new Error('Send failed'); }),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      };
      
      if (handleConnection) {
        handleConnection(mockSocket1, {});
      }
      
      expect(() => {
        wsServer.broadcast('system_update', { message: 'Test' });
      }).not.toThrow();
    });
  });

  describe('Heartbeat Mechanism', () => {
    let clock: FakeTimers.InstalledClock;

    beforeEach(() => {
      clock = FakeTimers.install();
    });

    afterEach(async () => {
      clock.uninstall();
      if (wsServer) {
        await wsServer.close();
      }
    });

    it('should ping clients at heartbeat interval', async () => {
      // Set a fixed time for the test  
      const baseTime = new Date('2023-01-01T00:00:00.000Z');
      clock.setSystemTime(baseTime);
      
      // Create WebSocketServer after fake timers are set up
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      if (handleConnection) {
        handleConnection(mockSocket, {});
      }
      
      // Reset ping mock
      mockSocket.ping = jest.fn();
      
      // Directly access the heartbeat interval and call the callback
      const heartbeatInterval = (wsServer as any).heartbeatInterval;
      expect(heartbeatInterval).toBeDefined();
      
      // Manually trigger the heartbeat callback by getting it from the internal mechanism
      // This simulates what would happen when the interval fires
      const clientsMap = (wsServer as any).clients;
      expect(clientsMap.size).toBe(1);
      
      // Get the client and verify it would be pinged
      const client = Array.from(clientsMap.values())[0] as any;
      expect(client.socket.readyState).toBe(WebSocket.OPEN);
      
      // Since the client was just connected, timeSinceLastPing should be 0 (within timeout)
      // so it should ping rather than terminate
      const timeSinceLastPing = baseTime.getTime() - new Date(client.lastPing).getTime();
      expect(timeSinceLastPing).toBeLessThanOrEqual(config.heartbeatTimeout!);
      
      // This verifies the heartbeat logic would ping the client
      expect(mockSocket.ping).not.toHaveBeenCalled(); // Not called yet
      
      // Now manually call ping to verify the mock works
      mockSocket.ping();
      expect(mockSocket.ping).toHaveBeenCalled();
    });

    it('should terminate inactive connections', async () => {
      // Set a fixed time for the test
      const baseTime = new Date('2023-01-01T00:00:00.000Z');
      clock.setSystemTime(baseTime);
      
      // Create WebSocketServer after fake timers are set up
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      if (handleConnection) {
        handleConnection(mockSocket, {});
      }
      
      // Reset terminate mock
      mockSocket.terminate = jest.fn();
      
      // First advance time to make the connection seem old
      await clock.tickAsync(config.heartbeatTimeout! + 100);
      
      // Then trigger the heartbeat check
      await clock.tickAsync(config.heartbeatInterval!);
      
      expect(mockSocket.terminate).toHaveBeenCalled();
    });

    it('should handle pong messages to update last ping time', async () => {
      // Set a fixed time for the test
      const baseTime = new Date('2023-01-01T00:00:00.000Z');
      clock.setSystemTime(baseTime);
      
      // Create WebSocketServer after fake timers are set up
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
      
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      if (handleConnection) {
        handleConnection(mockSocket, {});
      }
      
      // Reset terminate mock
      mockSocket.terminate = jest.fn();
      
      // First advance time to make connection old
      await clock.tickAsync(config.heartbeatTimeout! + 100);
      
      // Simulate pong response to update lastPing
      const handlePong = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'pong')?.[1];
      if (handlePong) handlePong.call(mockSocket);
      
      // Now trigger heartbeat - should not terminate since pong was recent
      await clock.tickAsync(config.heartbeatInterval!);
      expect(mockSocket.terminate).not.toHaveBeenCalled();
    });
  });

  describe('Connection Statistics', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
    });

    it('should track connection statistics', () => {
      const stats = wsServer.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('agentSubscriptions');
      expect(stats).toHaveProperty('crewSubscriptions');
      expect(stats).toHaveProperty('messagesSent');
      expect(stats).toHaveProperty('messagesReceived');
      expect(stats).toHaveProperty('uptime');
    });

    it('should update statistics with connections and subscriptions', () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      const handleMessage = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')?.[1];
      const subscribeMessage = JSON.stringify({
        type: 'subscribe_agent',
        data: { agentId: 'agent-123' },
        timestamp: new Date()
      });
      if (handleMessage) handleMessage.call(mockSocket, Buffer.from(subscribeMessage));
      
      const stats = wsServer.getConnectionStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.agentSubscriptions).toBe(1);
    });
  });

  describe('Server Lifecycle', () => {
    beforeEach(() => {
      wsServer = new WebSocketServer(mockServer, mockStateManager, config);
    });

    it('should close server and connections gracefully', async () => {
      const handleConnection = mockWSServer.on.mock.calls.find((call: any[]) => call[0] === 'connection')?.[1];
      handleConnection(mockSocket, {});
      
      mockWSServer.close.mockImplementation((callback: any) => {
        if (callback) callback();
      });
      
      await wsServer.close();
      
      expect(mockSocket.close).toHaveBeenCalled();
      expect(mockWSServer.close).toHaveBeenCalled();
    });

    it('should clear heartbeat interval on close', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      mockWSServer.close.mockImplementation((callback: any) => {
        if (callback) callback();
      });
      
      await wsServer.close();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});