import { Router, Request, Response } from 'express';
import { AgentRunner } from '../../agents/AgentRunner.js';
import { RedisService } from '../services/RedisService.js';
import { validate, executionRequestSchema, agentExecutionSchema } from '../middleware/validation.js';
import { ExecutionRequest, ExecutionMetadata } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

export const createAgentsRouter = (agentRunner: AgentRunner, redisService: RedisService): Router => {
  const router = Router();

  // List all agents (backward compatibility)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const agents = await agentRunner.getAllAgentStates();
      res.json(agents);
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
      const agentExecutions = activeExecutions.filter(id => id.startsWith('agent_'));
      res.json({
        executions: agentExecutions
      });
    } catch (error) {
      res.status(500).json({
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

  // Execute agent directly (NEW STATELESS API)
  router.post('/execute', validate(executionRequestSchema), async (req: Request, res: Response) => {
    try {
      const requestData: ExecutionRequest = req.body;
      
      const metadata: ExecutionMetadata = {
        configPath: requestData.configPath,
        task: requestData.task,
        input: requestData.input
      };

      const executionId = await redisService.createExecution(
        'agent',
        metadata,
        requestData.options?.ttl || 3600
      );

      // Execute asynchronously
      executeAgentAsync(executionId, requestData, agentRunner, redisService);

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

  // Create new agent (backward compatibility)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { configPath } = req.body;
      if (!configPath) {
        return res.status(400).json({ error: 'configPath is required' });
      }

      const agent = await agentRunner.createAgentFromConfig(configPath);
      res.json({
        message: 'Agent created successfully',
        agentId: agent.getDefinition().id
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get specific agent (backward compatibility)
  router.get('/:agentId', async (req: Request, res: Response) => {
    try {
      const agent = await agentRunner.getAgentState(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Execute task with agent (with optional HTTP streaming)
  router.post('/:agentId/execute', validate(agentExecutionSchema), async (req: Request, res: Response) => {
    try {
      const { task, context, stream } = req.body;
      const agentId = req.params.agentId;

      // Check if agent exists
      const agent = agentRunner.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      if (stream) {
        // HTTP Streaming via Server-Sent Events
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date(),
          agentId: agentId
        })}\n\n`);

        let accumulatedContent = '';

        // Listen for streaming events from the agent
        const streamHandler = (data: any) => {
          if (data.agentId === agentId) {
            accumulatedContent += data.content;
            res.write(`data: ${JSON.stringify({
              type: 'stream',
              content: data.content,
              accumulated: accumulatedContent,
              timestamp: new Date()
            })}\n\n`);
          }
        };

        const completedHandler = (data: any) => {
          if (data.agentId === agentId) {
            res.write(`data: ${JSON.stringify({
              type: 'completed',
              result: data.result,
              timestamp: new Date()
            })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
            
            // Clean up listeners
            agentRunner.off('agent_stream', streamHandler);
            agentRunner.off('agent_completed', completedHandler);
            agentRunner.off('agent_failed', failedHandler);
          }
        };

        const failedHandler = (data: any) => {
          if (data.agentId === agentId) {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: data.error,
              timestamp: new Date()
            })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
            
            // Clean up listeners
            agentRunner.off('agent_stream', streamHandler);
            agentRunner.off('agent_completed', completedHandler);
            agentRunner.off('agent_failed', failedHandler);
          }
        };

        // Set up event listeners
        agentRunner.on('agent_stream', streamHandler);
        agentRunner.on('agent_completed', completedHandler);
        agentRunner.on('agent_failed', failedHandler);

        // Handle client disconnect
        req.on('close', () => {
          agentRunner.off('agent_stream', streamHandler);
          agentRunner.off('agent_completed', completedHandler);
          agentRunner.off('agent_failed', failedHandler);
        });

        // Start the execution
        agentRunner.executeTask(agentId, task, context || {}).catch((error) => {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message,
            timestamp: new Date()
          })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
        });

      } else {
        // Regular non-streaming execution
        const result = await agentRunner.executeTask(
          agentId,
          task,
          context || {}
        );

        res.json({ result });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Reset agent (backward compatibility)
  router.post('/:agentId/reset', async (req: Request, res: Response) => {
    try {
      await agentRunner.resetAgent(req.params.agentId);
      res.json({ message: 'Agent reset successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
};

async function executeAgentAsync(
  executionId: string,
  request: ExecutionRequest,
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

    // Create agent from config
    const agent = await agentRunner.createAgentFromConfig(request.configPath);
    const agentId = agent.getDefinition().id;

    await redisService.updateExecutionStatus(
      executionId,
      'running',
      0.2,
      'agent_created'
    );

    // Execute the task
    const result = await agentRunner.executeTask(
      agentId,
      request.task || request.input || '',
      request.context || {}
    );

    const executionTime = Date.now() - startTime;

    await redisService.updateExecutionStatus(
      executionId,
      'completed',
      1.0,
      'completed',
      result
    );

    await redisService.incrementCompletedCount();

  } catch (error) {
    console.error(`Agent execution failed for ${executionId}:`, error);
    
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