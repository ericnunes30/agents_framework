import { describe, it, expect } from '@jest/globals';
import { AgentDefinitionSchema } from '../../src/config/schemas.js';
import type { AgentDefinition } from '../../src/config/schemas.js';

describe('Agent Configuration', () => {
  describe('AgentDefinition Schema Validation', () => {
    it('should validate minimal agent definition', () => {
      const minimalAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Test Role',
        goal: 'Test goal',
        backstory: 'Agent backstory',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          maxTokens: 2000
        }
      };

      const result = AgentDefinitionSchema.parse(minimalAgent);
      
      expect(result.id).toBe('test-agent');
      expect(result.name).toBe('Test Agent');
      expect(result.role).toBe('Test Role');
      expect(result.llm.provider).toBe('openai');
      expect(result.llm.model).toBe('gpt-4.1-mini');
    });

    it('should apply default values for optional fields', () => {
      const minimalAgent = {
        id: 'minimal-agent',
        name: 'Minimal Agent',
        role: 'Basic Role',
        goal: 'Basic goal',
        backstory: 'Basic backstory',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          maxTokens: 2000
        }
      };

      const result = AgentDefinitionSchema.parse(minimalAgent);
      
      expect(result.tools).toEqual([]);
      expect(result.maxIterations).toBe(5);
      expect(result.timeout).toBe(30000);
      expect(result.verbose).toBe(false);
      expect(result.llm.temperature).toBe(0.7);
    });

    it('should validate complete agent definition', () => {
      const completeAgent: AgentDefinition = {
        id: 'complete-agent',
        name: 'Complete Agent',
        role: 'Senior Researcher',
        goal: 'Conduct thorough research on given topics',
        backstory: 'An experienced researcher with expertise in data analysis and report writing.',
        tools: [
          'web_scraper',
          {
            name: 'custom_tool',
            enabled: true,
            config: { setting: 'value' }
          }
        ],
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.8,
          maxTokens: 2000,
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        maxIterations: 10,
        timeout: 60000,
        memory: {
          enabled: true,
          maxContextLength: 8000
        } as any,
        systemPrompt: 'You are a helpful research assistant.',
        verbose: true
      };

      const result = AgentDefinitionSchema.parse(completeAgent);
      
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0]).toBe('web_scraper');
      expect(typeof result.tools[1]).toBe('object');
      expect(result.llm.temperature).toBe(0.8);
      expect(result.llm.maxTokens).toBe(2000);
      expect(result.maxIterations).toBe(10);
      expect(result.timeout).toBe(60000);
      expect(result.memory?.enabled).toBe(true);
      expect(result.memory?.maxContextLength).toBe(8000);
      expect(result.systemPrompt).toBe('You are a helpful research assistant.');
      expect(result.verbose).toBe(true);
    });

    it('should validate both LLM providers', () => {
      const openaiAgent = {
        id: 'openai-agent',
        name: 'OpenAI Agent',
        role: 'Assistant',
        goal: 'Help users',
        backstory: 'OpenAI powered agent',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          maxTokens: 2000
        }
      };

      const openrouterAgent = {
        id: 'openrouter-agent',
        name: 'OpenRouter Agent',
        role: 'Assistant',
        goal: 'Help users',
        backstory: 'OpenRouter powered agent',
        llm: {
          provider: 'openrouter',
          model: 'anthropic/claude-3-sonnet',
          temperature: 0.7,
          maxTokens: 2000
        }
      };

      const openaiResult = AgentDefinitionSchema.parse(openaiAgent);
      const openrouterResult = AgentDefinitionSchema.parse(openrouterAgent);
      
      expect(openaiResult.llm.provider).toBe('openai');
      expect(openrouterResult.llm.provider).toBe('openrouter');
      expect(openrouterResult.llm.model).toBe('anthropic/claude-3-sonnet');
    });

    it('should validate tool configurations', () => {
      const agentWithTools = {
        id: 'tool-agent',
        name: 'Tool Agent',
        role: 'Tool User',
        goal: 'Use tools effectively',
        backstory: 'Agent specialized in tool usage',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          maxTokens: 2000
        },
        tools: [
          'simple-tool',
          {
            name: 'complex-tool',
            enabled: false,
            config: {
              retries: 3,
              timeout: 5000,
              endpoints: ['https://api1.com', 'https://api2.com']
            }
          }
        ]
      };

      const result = AgentDefinitionSchema.parse(agentWithTools);
      
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0]).toBe('simple-tool');
      
      const complexTool = result.tools[1] as any;
      expect(complexTool.name).toBe('complex-tool');
      expect(complexTool.enabled).toBe(false);
      expect(complexTool.config.retries).toBe(3);
      expect(complexTool.config.endpoints).toHaveLength(2);
    });

    it('should validate memory configuration', () => {
      const agentWithMemory = {
        id: 'memory-agent',
        name: 'Memory Agent',
        role: 'Memory User',
        goal: 'Remember context',
        backstory: 'Agent with enhanced memory',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          maxTokens: 2000
        },
        memory: {
          enabled: false,
          maxContextLength: 16000
        }
      };

      const result = AgentDefinitionSchema.parse(agentWithMemory);
      
      expect(result.memory?.enabled).toBe(false);
      expect(result.memory?.maxContextLength).toBe(16000);
    });

    it('should reject invalid agent definitions', () => {
      const invalidAgents = [
        // Missing required fields
        {
          id: 'incomplete-agent',
          name: 'Incomplete Agent'
          // Missing role, goal, backstory, llm
        },
        // Empty ID
        {
          id: '',
          name: 'Empty ID Agent',
          role: 'Role',
          goal: 'Goal',
          backstory: 'Backstory',
          llm: { provider: 'openai', model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 2000 }
        },
        // Invalid LLM provider
        {
          id: 'invalid-llm-agent',
          name: 'Invalid LLM Agent',
          role: 'Role',
          goal: 'Goal',
          backstory: 'Backstory',
          llm: { provider: 'invalid-provider', model: 'some-model' }
        },
        // Invalid temperature range
        {
          id: 'invalid-temp-agent',
          name: 'Invalid Temp Agent',
          role: 'Role',
          goal: 'Goal',
          backstory: 'Backstory',
          llm: { 
            provider: 'openai', 
            model: 'gpt-4.1-mini',
            temperature: 3.0 // Invalid: > 2
          }
        }
      ];

      invalidAgents.forEach((invalidAgent, index) => {
        expect(() => {
          AgentDefinitionSchema.parse(invalidAgent);
        }).toThrow();
      });
    });

    it('should validate LLM configuration constraints', () => {
      const validLLMConfigs = [
        {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.0, // Min temperature
          maxTokens: 2000
        },
        {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 2.0, // Max temperature
          maxTokens: 2000
        },
        {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          maxTokens: 1, // Min tokens
          temperature: 0.7
        }
      ];

      validLLMConfigs.forEach(llmConfig => {
        const agent = {
          id: 'llm-test-agent',
          name: 'LLM Test Agent',
          role: 'Tester',
          goal: 'Test LLM configs',
          backstory: 'Testing agent',
          llm: llmConfig
        };

        expect(() => {
          AgentDefinitionSchema.parse(agent);
        }).not.toThrow();
      });
    });

    it('should validate timeout and iteration constraints', () => {
      const agentWithConstraints = {
        id: 'constraint-agent',
        name: 'Constraint Agent',
        role: 'Constraint Tester',
        goal: 'Test constraints',
        backstory: 'Testing constraints',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini'
        },
        maxIterations: 1, // Minimum iterations
        timeout: 1000 // Minimum timeout
      };

      const result = AgentDefinitionSchema.parse(agentWithConstraints);
      
      expect(result.maxIterations).toBe(1);
      expect(result.timeout).toBe(1000);
    });
  });
});