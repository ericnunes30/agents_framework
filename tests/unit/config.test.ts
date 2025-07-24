import { describe, it, expect } from '@jest/globals';
import { ConfigLoader } from '../../src/config/loader.js';
import { AgentDefinitionSchema, CrewDefinitionSchema } from '../../src/config/schemas.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigLoader', () => {
  const testDir = join(tmpdir(), 'agent-framework-tests');
  
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  describe('AgentDefinitionSchema', () => {
    it('should validate valid agent configuration', () => {
      const validConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Test Role',
        backstory: 'Test backstory',
        goal: 'Test goal',
        llm: {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          temperature: 0.7,
          max_tokens: 2000
        },
        tools: [
          {
            name: 'web_scraper',
            enabled: true
          }
        ],
        system_prompt: 'Test prompt',
        max_iterations: 5,
        verbose: true
      };

      const result = AgentDefinitionSchema.parse(validConfig);
      expect(result.id).toBe('test-agent');
      expect(result.name).toBe('Test Agent');
    });

    it('should reject invalid agent configuration', () => {
      const invalidConfig = {
        id: 'test-agent',
        // Missing required fields
      };

      expect(() => AgentDefinitionSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('CrewDefinitionSchema', () => {
    it('should validate valid crew configuration', () => {
      const validConfig = {
        id: 'test-crew',
        name: 'Test Crew',
        description: 'Test crew description',
        process: 'sequential',
        agents: ['agent1'],
        tasks: [
          {
            id: 'task1',
            description: 'Test task description',
            agent: 'agent1',
            expectedOutput: 'Test output'
          }
        ],
        verbose: true,
        maxIterations: 10
      };

      const result = CrewDefinitionSchema.parse(validConfig);
      expect(result.id).toBe('test-crew');
      expect(result.process).toBe('sequential');
    });
  });

  describe('ConfigLoader', () => {
    it('should load agent configuration from YAML', () => {
      const yamlContent = `
id: test-agent
name: Test Agent
role: Test Role
backstory: Test backstory
goal: Test goal
llm:
  provider: openai
  model: gpt-4.1-mini
  temperature: 0.7
  max_tokens: 2000
`;

      const filePath = join(testDir, 'test-agent.yaml');
      writeFileSync(filePath, yamlContent);

      const config = ConfigLoader.loadAgentConfig(filePath);
      expect(config.id).toBe('test-agent');
      expect(config.name).toBe('Test Agent');
    });

    it('should load crew configuration from YAML', () => {
      const yamlContent = `
id: test-crew
name: Test Crew
description: Test crew description
process: sequential
agents:
  - agent1
tasks:
  - id: task1
    description: Test task
    agent: agent1
    expectedOutput: Test output
`;

      const filePath = join(testDir, 'test-crew.yaml');
      writeFileSync(filePath, yamlContent);

      const config = ConfigLoader.loadCrewConfig(filePath);
      expect(config.id).toBe('test-crew');
      expect(config.process).toBe('sequential');
    });
  });
});