import { corsMiddleware, strictCorsMiddleware } from '../../../src/http/middleware/cors.js';

// Mock cors module
jest.mock('cors', () => {
  return jest.fn((options) => {
    // Return a mock middleware function that captures the options
    const middleware = jest.fn((req, res, next) => {
      next();
    }) as any;
    // Store options for testing
    middleware.options = options;
    return middleware;
  });
});

describe('CORS Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.CORS_ORIGIN;
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('corsMiddleware', () => {
    it('should be created with default options', () => {
      expect(corsMiddleware).toBeDefined();
      expect(typeof corsMiddleware).toBe('function');
      
      // Check that cors was called with default options
      const expectedOptions = {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: false,
        maxAge: 86400
      };
      
      expect((corsMiddleware as any).options).toMatchObject(expectedOptions);
    });

    it('should use CORS_ORIGIN environment variable', () => {
      process.env.CORS_ORIGIN = 'https://example.com';
      
      // Re-import to get fresh middleware with new env var
      jest.resetModules();
      const { corsMiddleware: newCorsMiddleware } = require('../../../src/http/middleware/cors.js');
      
      expect((newCorsMiddleware as any).options.origin).toBe('https://example.com');
    });

    it('should have correct method configuration', () => {
      const expectedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      expect((corsMiddleware as any).options.methods).toEqual(expectedMethods);
    });

    it('should have correct headers configuration', () => {
      const expectedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'];
      expect((corsMiddleware as any).options.allowedHeaders).toEqual(expectedHeaders);
    });

    it('should have credentials disabled by default', () => {
      expect((corsMiddleware as any).options.credentials).toBe(false);
    });

    it('should have correct maxAge', () => {
      expect((corsMiddleware as any).options.maxAge).toBe(86400);
    });
  });

  describe('strictCorsMiddleware', () => {
    it('should be created with strict options', () => {
      expect(strictCorsMiddleware).toBeDefined();
      expect(typeof strictCorsMiddleware).toBe('function');
      
      // Should have credentials enabled
      expect((strictCorsMiddleware as any).options.credentials).toBe(true);
    });

    it('should have origin function for validation', () => {
      const options = (strictCorsMiddleware as any).options;
      expect(typeof options.origin).toBe('function');
    });

    it('should allow localhost by default', () => {
      const options = (strictCorsMiddleware as any).options;
      const mockCallback = jest.fn();
      
      // Test with localhost origin
      options.origin('http://localhost:3000', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should allow undefined origin (same-origin requests)', () => {
      const options = (strictCorsMiddleware as any).options;
      const mockCallback = jest.fn();
      
      // Test with undefined origin (same-origin request)
      options.origin(undefined, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should use ALLOWED_ORIGINS environment variable', () => {
      process.env.ALLOWED_ORIGINS = 'https://app1.com,https://app2.com';
      
      // Re-import to get fresh middleware with new env var
      jest.resetModules();
      const { strictCorsMiddleware: newStrictCorsMiddleware } = require('../../../src/http/middleware/cors.js');
      
      const options = (newStrictCorsMiddleware as any).options;
      const mockCallback = jest.fn();
      
      // Test with allowed origin
      options.origin('https://app1.com', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, true);
      
      // Test with disallowed origin
      mockCallback.mockClear();
      options.origin('https://evil.com', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject disallowed origins', () => {
      const options = (strictCorsMiddleware as any).options;
      const mockCallback = jest.fn();
      
      // Test with disallowed origin
      options.origin('https://evil.com', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
      expect(mockCallback.mock.calls[0][0].message).toBe('Not allowed by CORS');
    });

    it('should have same methods as default CORS', () => {
      const defaultOptions = (corsMiddleware as any).options;
      const strictOptions = (strictCorsMiddleware as any).options;
      
      expect(strictOptions.methods).toEqual(defaultOptions.methods);
    });

    it('should have same headers as default CORS', () => {
      const defaultOptions = (corsMiddleware as any).options;
      const strictOptions = (strictCorsMiddleware as any).options;
      
      expect(strictOptions.allowedHeaders).toEqual(defaultOptions.allowedHeaders);
    });

    it('should have same maxAge as default CORS', () => {
      const defaultOptions = (corsMiddleware as any).options;
      const strictOptions = (strictCorsMiddleware as any).options;
      
      expect(strictOptions.maxAge).toEqual(defaultOptions.maxAge);
    });
  });
});