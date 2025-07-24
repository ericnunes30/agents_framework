import { Router, Request, Response } from 'express';
import { StateManager } from '../../state/StateManager.js';
import { RedisService } from '../services/RedisService.js';

export const createHealthRouter = (stateManager: StateManager, redisService: RedisService): Router => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const [health, redisInfo] = await Promise.all([
        stateManager.healthCheck(),
        redisService.getRedisInfo()
      ]);

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: redisInfo,
        health
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};