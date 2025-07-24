import { Router, Request, Response } from 'express';
import { CrewRunner } from '../../crews/CrewRunner.js';
import { AgentRunner } from '../../agents/AgentRunner.js';
import { RedisService } from '../services/RedisService.js';
import { validate, executionRequestSchema } from '../middleware/validation.js';
import { ExecutionRequest, ExecutionMetadata } from '../types.js';

export const createCrewsRouter = (
  crewRunner: CrewRunner,
  agentRunner: AgentRunner,
  redisService: RedisService
): Router => {
  const router = Router();

  // List all crews (backward compatibility)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const crews = await crewRunner.getAllCrewStates();
      res.json(crews);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List active executions
  router.get('/active', async (req: Request, res: Response) => {
    try {
      const activeExecutions = await redisService.getActiveExecutions();
      const crewExecutions = activeExecutions.filter(id => id.startsWith('crew_'));
      res.json({
        executions: crewExecutions
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific crew (backward compatibility)
  router.get('/:crewId', async (req: Request, res: Response) => {
    try {
      const crew = await crewRunner.getCrewState(req.params.crewId);
      if (!crew) {
        return res.status(404).json({ error: 'Crew not found' });
      }
      res.json(crew);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create new crew (backward compatibility)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { configPath } = req.body;
      if (!configPath) {
        return res.status(400).json({ error: 'configPath is required' });
      }

      const crew = await crewRunner.createCrewFromConfig(configPath);
      res.json({
        message: 'Crew created successfully',
        crewId: crew.getDefinition().id
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Execute crew directly (NEW STATELESS API)
  router.post('/execute', validate(executionRequestSchema), async (req: Request, res: Response) => {
    try {
      const requestData: ExecutionRequest = req.body;
      
      const metadata: ExecutionMetadata = {
        configPath: requestData.configPath,
        input: requestData.input,
        task: requestData.task
      };

      const executionId = await redisService.createExecution(
        'crew',
        metadata,
        requestData.options?.ttl || 3600
      );

      // Execute asynchronously
      executeCrewAsync(executionId, requestData, crewRunner, agentRunner, redisService);

      res.json({
        executionId,
        status: 'started'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get execution status
  router.get('/status/:executionId', async (req: Request, res: Response) => {
    try {
      const status = await redisService.getExecutionStatus(req.params.executionId);
      if (!status) {
        return res.status(404).json({ error: 'Execution not found' });
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get execution results
  router.get('/results/:executionId', async (req: Request, res: Response) => {
    try {
      const result = await redisService.getExecutionResult(req.params.executionId);
      if (!result) {
        return res.status(404).json({ error: 'Result not found or execution not completed' });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List active executions
  router.get('/active', async (req: Request, res: Response) => {
    try {
      const activeExecutions = await redisService.getActiveExecutions();
      const crewExecutions = activeExecutions.filter(id => id.startsWith('crew_'));
      res.json({
        executions: crewExecutions
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Execute crew (backward compatibility)
  router.post('/:crewId/execute', async (req: Request, res: Response) => {
    try {
      const { input, context } = req.body;
      if (!input) {
        return res.status(400).json({ error: 'input is required' });
      }

      const result = await crewRunner.executeCrewWithContext(
        req.params.crewId,
        input,
        context || {}
      );

      res.json({ result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get crew execution logs (backward compatibility)
  router.get('/:crewId/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await crewRunner.getCrewLogs(req.params.crewId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Reset crew (backward compatibility)
  router.post('/:crewId/reset', async (req: Request, res: Response) => {
    try {
      await crewRunner.resetCrew(req.params.crewId);
      res.json({ message: 'Crew reset successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Cancel crew execution (backward compatibility)
  router.post('/:crewId/cancel', async (req: Request, res: Response) => {
    try {
      const crew = crewRunner.getCrew(req.params.crewId);
      if (!crew) {
        return res.status(404).json({ error: 'Crew not found' });
      }

      await crew.cancel();
      res.json({ message: 'Crew execution cancelled' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};

async function executeCrewAsync(
  executionId: string,
  request: ExecutionRequest,
  crewRunner: CrewRunner,
  agentRunner: AgentRunner,
  redisService: RedisService
): Promise<void> {
  const startTime = Date.now();
  
  try {
    await redisService.updateExecutionStatus(
      executionId,
      'running',
      0,
      'initializing'
    );

    // Create crew from config
    const crew = await crewRunner.createCrewFromConfig(request.configPath);
    const crewId = crew.getDefinition().id;

    await redisService.updateExecutionStatus(
      executionId,
      'running',
      0.1,
      'crew_created'
    );

    // Execute the crew
    const result = await crewRunner.executeCrewWithContext(
      crewId,
      request.input || request.task || '',
      request.context || {}
    );

    await redisService.updateExecutionStatus(
      executionId,
      'completed',
      1.0,
      'completed',
      result
    );

    await redisService.incrementCompletedCount();

  } catch (error) {
    console.error(`Crew execution failed for ${executionId}:`, error);
    
    await redisService.updateExecutionStatus(
      executionId,
      'failed',
      undefined,
      'failed',
      undefined,
      error instanceof Error ? error.message : String(error)
    );
  }
}