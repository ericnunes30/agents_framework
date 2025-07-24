import { z } from 'zod';

/**
 * Schema for LLM configuration
 */
export const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'openrouter']),
  model: z.string().min(1, 'Model name is required'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
  apiKey: z.string().optional(), // Can use env var instead
  baseURL: z.string().url().optional() // For custom endpoints
});

/**
 * Schema for tool configuration
 */
export const ToolConfigSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  type: z.enum(['mcp', 'web-scraper', 'redis', 'custom']),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().default(true)
});

/**
 * Schema for agent definition
 */
export const AgentDefinitionSchema = z.object({
  id: z.string().min(1, 'Agent ID is required'),
  name: z.string().min(1, 'Agent name is required'),
  role: z.string().min(1, 'Agent role is required'),
  goal: z.string().min(1, 'Agent goal is required'),
  backstory: z.string().min(1, 'Agent backstory is required'),
  tools: z.array(
    z.union([
      z.string(), // Simple tool name
      z.object({  // Complex tool configuration
        name: z.string().min(1, 'Tool name is required'),
        enabled: z.boolean().default(true),
        config: z.record(z.any()).optional()
      })
    ])
  ).optional().default([]),
  llm: LLMConfigSchema,
  maxIterations: z.number().positive().default(5),
  timeout: z.number().positive().default(30000),
  memory: z.object({
    enabled: z.boolean().default(true),
    maxContextLength: z.number().positive().default(4000)
  }).optional(),
  systemPrompt: z.string().optional(),
  verbose: z.boolean().optional().default(false)
});

/**
 * Schema for task definition within a crew
 */
export const TaskDefinitionSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  description: z.string().min(1, 'Task description is required'),
  agent: z.string().min(1, 'Agent ID is required'),
  expectedOutput: z.string().optional(),
  context: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  outputKey: z.string().optional(), // Key to store output in context
  validateOutput: z.boolean().default(false)
});

/**
 * Schema for crew definition
 */
export const CrewDefinitionSchema = z.object({
  id: z.string().min(1, 'Crew ID is required'),
  name: z.string().min(1, 'Crew name is required'),
  description: z.string().min(1, 'Crew description is required'),
  agents: z.array(z.string()).min(1, 'At least one agent is required'),
  process: z.enum(['sequential', 'hierarchical', 'collaborative']).default('sequential'),
  tasks: z.array(TaskDefinitionSchema).min(1, 'At least one task is required'),
  sharedContext: z.record(z.any()).optional().default({}),
  maxIterations: z.number().positive().default(10),
  verbose: z.boolean().default(false)
});

/**
 * Schema for environment configuration
 */
export const EnvironmentConfigSchema = z.object({
  openai: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().url().optional()
  }).optional(),
  openrouter: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().url().optional()
  }).optional(),
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    password: z.string().optional()
  }),
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost')
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().optional()
  }).optional()
});

// Type exports
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;
export type CrewDefinition = z.infer<typeof CrewDefinitionSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;