import { BaseClient } from './BaseClient.js';
import { ChatMessage, ChatResponse, StreamResponse, LLMRequestConfig } from './types.js';

/**
 * OpenAI HTTP API client implementation
 */
export class OpenAIClient extends BaseClient {
  constructor(apiKey?: string) {
    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    super(
      openaiApiKey,
      'https://api.openai.com/v1',
      {
        'Authorization': `Bearer ${openaiApiKey}`,
        'User-Agent': 'Agent-Framework/1.0.0'
      }
    );
  }

  /**
   * Send chat completion request to OpenAI
   */
  async chat(messages: ChatMessage[], config: LLMRequestConfig = {}): Promise<ChatResponse> {
    const payload = {
      model: config.model || 'gpt-4.1-mini',
      messages: this.formatMessages(messages),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stop: config.stop,
      stream: false
    };

    return await this.makeRequest('/chat/completions', payload);
  }

  /**
   * Send streaming chat completion request to OpenAI
   */
  async *stream(messages: ChatMessage[], config: LLMRequestConfig = {}): AsyncIterable<StreamResponse> {
    const payload = {
      model: config.model || 'gpt-4.1-mini',
      messages: this.formatMessages(messages),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stop: config.stop,
      stream: true
    };

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Test OpenAI API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: this.defaultHeaders
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available OpenAI models
   */
  async listModels(): Promise<string[]> {
    const response = await this.makeRequest('/models', {});
    return response.data?.map((model: any) => model.id) || [];
  }

  /**
   * Calculate estimated cost for request
   */
  calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    // Pricing per 1K tokens as of 2024
    const pricing = {
      'gpt-4.1': { input: 0.05, output: 0.15 },
      'gpt-4.1-mini': { input: 0.015, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 }
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4.1-mini'];
    return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1000;
  }
}