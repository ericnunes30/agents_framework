import { BaseClient } from './BaseClient.js';
import { ChatMessage, ChatResponse, StreamResponse, LLMRequestConfig } from './types.js';

/**
 * OpenRouter HTTP API client implementation
 */
export class OpenRouterClient extends BaseClient {
  constructor(apiKey?: string) {
    const openrouterApiKey = apiKey || process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.');
    }

    super(
      openrouterApiKey,
      'https://openrouter.ai/api/v1',
      {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Agent Framework',
        'User-Agent': 'Agent-Framework/1.0.0'
      }
    );
  }

  /**
   * Send chat completion request to OpenRouter
   */
  async chat(messages: ChatMessage[], config: LLMRequestConfig = {}): Promise<ChatResponse> {
    const payload = {
      model: config.model || 'anthropic/claude-3.5-sonnet',
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
   * Send streaming chat completion request to OpenRouter
   */
  async *stream(messages: ChatMessage[], config: LLMRequestConfig = {}): AsyncIterable<StreamResponse> {
    const payload = {
      model: config.model || 'anthropic/claude-3.5-sonnet',
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
   * Test OpenRouter API connection
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
   * List available models from OpenRouter
   */
  async listModels(): Promise<string[]> {
    const response = await this.makeRequest('/models', {});
    return response.data?.map((model: any) => model.id) || [];
  }

  /**
   * Get model information including pricing
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/models/${modelId}`, {});
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Calculate estimated cost for request using OpenRouter pricing
   */
  async calculateCost(inputTokens: number, outputTokens: number, model: string): Promise<number> {
    try {
      const modelInfo = await this.getModelInfo(model);
      if (modelInfo && modelInfo.pricing) {
        const { prompt, completion } = modelInfo.pricing;
        return (inputTokens * prompt + outputTokens * completion) / 1000;
      }
      
      // Fallback to common pricing if model info not available
      return 0.01; // Default fallback
    } catch {
      return 0.01; // Default fallback
    }
  }

  /**
   * Get usage statistics for the current API key
   */
  async getUsageStats(): Promise<any> {
    const response = await fetch(`${this.baseURL}/usage`, {
      method: 'GET',
      headers: this.defaultHeaders
    });

    if (!response.ok) {
      throw new Error(`Failed to get usage stats: ${response.statusText}`);
    }

    return await response.json();
  }
}