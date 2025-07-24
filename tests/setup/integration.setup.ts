/**
 * Integration Test Setup
 * This file sets up the test environment for integration tests
 */

// Mock Redis for integration tests
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    status: 'ready',
    on: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    scard: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    dbsize: jest.fn().mockResolvedValue(0),
    info: jest.fn().mockResolvedValue('used_memory_human:1MB\r\nconnected_clients:1\r\nredis_version:7.0.11\r\n'),
    time: jest.fn().mockResolvedValue(['1642176000', '123456']),
    subscribe: jest.fn().mockResolvedValue(1),
    unsubscribe: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1)
  }));
});

// Mock WebSocket for integration tests
jest.mock('ws', () => ({
  WebSocket: {
    OPEN: 1,
    CLOSED: 3,
    CONNECTING: 0,
    CLOSING: 2
  }
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.USE_HYBRID = 'true';

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Allow time for async cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

export {};