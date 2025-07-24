import { describe, it, expect } from '@jest/globals';
import { ChatMessage, ChatResponse, LLMRequestConfig, LLMError } from '../../src/llm/types.js';

describe('LLM Types', () => {
  describe('ChatMessage', () => {
    it('should have valid message structure', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello, world!'
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should support system messages', () => {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: 'You are a helpful assistant.'
      };

      expect(systemMessage.role).toBe('system');
    });

    it('should support assistant messages', () => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: 'How can I help you today?'
      };

      expect(assistantMessage.role).toBe('assistant');
    });

    it('should support optional name field', () => {
      const namedMessage: ChatMessage = {
        role: 'user',
        content: 'Hello',
        name: 'John'
      };

      expect(namedMessage.name).toBe('John');
    });
  });

  describe('LLMRequestConfig', () => {
    it('should have optional configuration fields', () => {
      const config: LLMRequestConfig = {
        model: 'gpt-4.1-mini',
        temperature: 0.7,
        maxTokens: 1000
      };

      expect(config.model).toBe('gpt-4.1-mini');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
    });

    it('should support empty configuration', () => {
      const config: LLMRequestConfig = {};
      expect(typeof config).toBe('object');
    });

    it('should support all optional fields', () => {
      const fullConfig: LLMRequestConfig = {
        model: 'gpt-4.1-mini',
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        stop: ['\\n', '###'],
        stream: true
      };

      expect(fullConfig.stop).toEqual(['\\n', '###']);
      expect(fullConfig.stream).toBe(true);
    });
  });

  describe('LLMError', () => {
    it('should create basic LLM error', () => {
      const error = new LLMError('Something went wrong');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('LLMError');
    });

    it('should create LLM error with status code', () => {
      const error = new LLMError('API Error', 500, 'openai', 'gpt-4.1-mini');

      expect(error.statusCode).toBe(500);
      expect(error.provider).toBe('openai');
      expect(error.model).toBe('gpt-4.1-mini');
    });

    it('should create rate limit error', () => {
      const error = new LLMError('Rate limit exceeded', 429, 'openai');

      expect(error.statusCode).toBe(429);
      expect(error.provider).toBe('openai');
    });
  });

  describe('ChatResponse Structure', () => {
    it('should validate ChatResponse structure', () => {
      const response: ChatResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1694268190,
        model: 'gpt-4.1-mini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      expect(response.id).toBe('chatcmpl-123');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe('assistant');
      expect(response.usage.total_tokens).toBe(30);
    });

    it('should support multiple choices', () => {
      const response: ChatResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1694268190,
        model: 'gpt-4.1-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'First response' },
            finish_reason: 'stop'
          },
          {
            index: 1,
            message: { role: 'assistant', content: 'Second response' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40
        }
      };

      expect(response.choices).toHaveLength(2);
      expect(response.choices[1].message.content).toBe('Second response');
    });
  });
});