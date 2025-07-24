import { Router, Request, Response } from 'express';
import { StateManager } from '../../state/StateManager.js';
import { RedisService } from '../services/RedisService.js';
import { TTLManager } from '../services/TTLManager.js';
import { CrewRunner } from '../../crews/CrewRunner.js';

export const createSystemRouter = (
  stateManager: StateManager,
  redisService: RedisService,
  ttlManager: TTLManager,
  crewRunner: CrewRunner
): Router => {
  const router = Router();

  // System statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await redisService.getSystemStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Redis information
  router.get('/redis', async (req: Request, res: Response) => {
    try {
      const redisInfo = await redisService.getRedisInfo();
      res.json(redisInfo);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // System overview (backward compatibility)
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const overview = await crewRunner.getSystemOverview();
      res.json(overview);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // TTL Manager stats
  router.get('/ttl', async (req: Request, res: Response) => {
    try {
      const [cleanupStats, config] = await Promise.all([
        ttlManager.getCleanupStats(),
        Promise.resolve(ttlManager.getConfig())
      ]);

      res.json({
        config,
        lastCleanup: cleanupStats,
        status: 'active'
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Active executions
  router.get('/executions/active', async (req: Request, res: Response) => {
    try {
      const activeExecutions = await redisService.getActiveExecutions();
      res.json({
        executions: activeExecutions,
        count: activeExecutions.length
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};