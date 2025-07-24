import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError, APIError } from '../types.js';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.path.reduce((obj, key) => obj?.[key], req.body)
        }));

        const apiError: APIError = {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
          timestamp: new Date()
        };

        return res.status(400).json(apiError);
      }
      
      next(error);
    }
  };
};

export const executionRequestSchema = z.object({
  configPath: z.string().min(1, 'Config path is required'),
  task: z.string().optional(),
  input: z.string().optional(),
  context: z.record(z.any()).optional(),
  options: z.object({
    streaming: z.boolean().optional(),
    timeout: z.number().positive().optional(),
    maxIterations: z.number().positive().optional(),
    ttl: z.number().positive().optional()
  }).optional()
});

export const configValidationSchema = z.object({
  type: z.enum(['agent', 'crew']),
  configPath: z.string().min(1, 'Config path is required')
});

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);

  const apiError: APIError = {
    error: error.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date()
  };

  if (error.name === 'ValidationError') {
    apiError.code = 'VALIDATION_ERROR';
    return res.status(400).json(apiError);
  }

  if (error.name === 'NotFoundError') {
    apiError.code = 'NOT_FOUND';
    return res.status(404).json(apiError);
  }

  res.status(500).json(apiError);
};