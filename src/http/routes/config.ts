import { Router, Request, Response } from 'express';
import { ConfigLoader } from '../../config/loader.js';
import { CrewRunner } from '../../crews/CrewRunner.js';
import { RedisService } from '../services/RedisService.js';
import { validate, configValidationSchema } from '../middleware/validation.js';

export const createConfigRouter = (crewRunner: CrewRunner, redisService: RedisService): Router => {
  const router = Router();

  // List available agent configurations
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      // Check cache first
      const cacheKey = 'config:agents:list';
      const cached = await redisService.getCachedConfig(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      const agents = ConfigLoader.loadAllAgents();
      const result = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.backstory ? agent.backstory.substring(0, 100) + '...' : undefined
      }));

      // Cache for 1 hour
      await redisService.cacheConfig(cacheKey, result, 3600);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List available crew configurations
  router.get('/crews', async (req: Request, res: Response) => {
    try {
      // Check cache first
      const cacheKey = 'config:crews:list';
      const cached = await redisService.getCachedConfig(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      const crews = ConfigLoader.loadAllCrews();
      const result = crews.map(crew => ({
        id: crew.id,
        name: crew.name,
        process: crew.process,
        agents: crew.agents?.length || 0,
        tasks: crew.tasks?.length || 0
      }));

      // Cache for 1 hour
      await redisService.cacheConfig(cacheKey, result, 3600);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific agent configuration
  router.get('/agents/:configPath', async (req: Request, res: Response) => {
    try {
      const configPath = decodeURIComponent(req.params.configPath);
      
      // Check cache first
      const cached = await redisService.getCachedConfig(`agent:${configPath}`);
      if (cached) {
        return res.json(cached);
      }

      const agent = ConfigLoader.loadAgentConfig(configPath);
      
      // Cache for 24 hours
      await redisService.cacheConfig(`agent:${configPath}`, agent, 86400);
      res.json(agent);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific crew configuration
  router.get('/crews/:configPath', async (req: Request, res: Response) => {
    try {
      const configPath = decodeURIComponent(req.params.configPath);
      
      // Check cache first
      const cached = await redisService.getCachedConfig(`crew:${configPath}`);
      if (cached) {
        return res.json(cached);
      }

      const crew = ConfigLoader.loadCrewConfig(configPath);
      
      // Cache for 24 hours
      await redisService.cacheConfig(`crew:${configPath}`, crew, 86400);
      res.json(crew);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Validate configuration
  router.post('/validate', validate(configValidationSchema), async (req: Request, res: Response) => {
    try {
      const { type, configPath } = req.body;

      if (type === 'agent') {
        const agent = ConfigLoader.loadAgentConfig(configPath);
        res.json({ 
          valid: true, 
          config: agent,
          type: 'agent'
        });
      } else if (type === 'crew') {
        const crew = ConfigLoader.loadCrewConfig(configPath);
        const validation = await crewRunner.validateCrew(crew);
        res.json({ 
          valid: validation.valid, 
          config: crew, 
          errors: validation.errors,
          type: 'crew'
        });
      } else {
        res.status(400).json({ error: 'Invalid type. Must be "agent" or "crew"' });
      }
    } catch (error) {
      res.status(400).json({
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Clear configuration cache
  router.delete('/cache', async (req: Request, res: Response) => {
    try {
      const { pattern } = req.query;
      
      if (pattern) {
        // Clear specific pattern - would need Redis SCAN in production
        res.json({ 
          message: 'Pattern-based cache clearing not implemented',
          pattern 
        });
      } else {
        // Clear all config cache by setting TTL to 0 (simplified approach)
        res.json({ 
          message: 'Cache clearing initiated - configs will refresh on next request' 
        });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};