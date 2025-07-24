import { 
  validate, 
  executionRequestSchema, 
  configValidationSchema, 
  errorHandler 
} from '../../../src/http/middleware/validation.js';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;


  beforeEach(() => {
    mockReq = {
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('validate', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      age: z.number().positive('Age must be positive')
    });

    it('should pass validation with valid data', () => {
      mockReq.body = { name: 'John', age: 25 };

      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      mockReq.body = { name: '', age: -5 };

      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'name',
            message: 'Name is required',
            value: ''
          },
          {
            field: 'age',
            message: 'Age must be positive',
            value: -5
          }
        ],
        timestamp: expect.any(Date)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', () => {
      mockReq.body = {};

      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'name',
            message: 'Required',
            value: undefined
          },
          {
            field: 'age',
            message: 'Required',
            value: undefined
          }
        ],
        timestamp: expect.any(Date)
      });
    });

    it('should handle nested field validation errors', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email('Invalid email')
          })
        })
      });

      mockReq.body = {
        user: {
          profile: {
            email: 'invalid-email'
          }
        }
      };

      const middleware = validate(nestedSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'user.profile.email',
            message: 'Invalid email',
            value: 'invalid-email'
          }
        ],
        timestamp: expect.any(Date)
      });
    });

    it('should pass validation errors to next middleware', () => {
      const faultySchema = null as any;

      const middleware = validate(faultySchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('executionRequestSchema', () => {
    it('should validate valid execution request', () => {
      const validData = {
        configPath: 'examples/agents/basic-agent.yaml',
        task: 'Research AI trends',
        options: {
          streaming: false,
          timeout: 60000
        }
      };

      expect(() => executionRequestSchema.parse(validData)).not.toThrow();
    });

    it('should require configPath', () => {
      const invalidData = {
        task: 'Research AI trends'
      };

      expect(() => executionRequestSchema.parse(invalidData)).toThrow();
    });

    it('should allow optional fields', () => {
      const minimalData = {
        configPath: 'examples/agents/basic-agent.yaml'
      };

      expect(() => executionRequestSchema.parse(minimalData)).not.toThrow();
    });

    it('should validate options object', () => {
      const dataWithInvalidOptions = {
        configPath: 'examples/agents/basic-agent.yaml',
        options: {
          timeout: -1000 // Invalid negative timeout
        }
      };

      expect(() => executionRequestSchema.parse(dataWithInvalidOptions)).toThrow();
    });
  });

  describe('configValidationSchema', () => {
    it('should validate agent config request', () => {
      const validData = {
        type: 'agent',
        configPath: 'examples/agents/basic-agent.yaml'
      };

      expect(() => configValidationSchema.parse(validData)).not.toThrow();
    });

    it('should validate crew config request', () => {
      const validData = {
        type: 'crew',
        configPath: 'examples/crews/research-crew.yaml'
      };

      expect(() => configValidationSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid type', () => {
      const invalidData = {
        type: 'invalid',
        configPath: 'examples/agents/basic-agent.yaml'
      };

      expect(() => configValidationSchema.parse(invalidData)).toThrow();
    });

    it('should require configPath', () => {
      const invalidData = {
        type: 'agent'
      };

      expect(() => configValidationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('errorHandler', () => {
    it('should handle validation errors', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      errorHandler(validationError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(Date)
      });
    });

    it('should handle not found errors', () => {
      const notFoundError = new Error('Resource not found');
      notFoundError.name = 'NotFoundError';

      errorHandler(notFoundError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Resource not found',
        code: 'NOT_FOUND',
        timestamp: expect.any(Date)
      });
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(Date)
      });
    });

    it('should handle errors without message', () => {
      const error = new Error();

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(Date)
      });
    });
  });
});