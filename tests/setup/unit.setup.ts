/**
 * Unit Test Setup
 * This file sets up the test environment for unit tests
 */

// Global mocks for unit tests
jest.mock('fs');
jest.mock('path');

// Console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

// Global test configuration
jest.setTimeout(10000); // 10 seconds for unit tests

// Mock timers for tests that use setInterval/setTimeout
beforeEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

export {};