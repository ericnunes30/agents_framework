import { LLMClient, ChatMessage, ChatResponse, StreamResponse, LLMRequestConfig, LLMError } from './types.js';

/**
 * Base HTTP client for LLM providers
 */
export abstract class BaseClient implements LLMClient {
  protected apiKey: string;
  protected baseURL: string;
  protected defaultHeaders: Record<string, string>;

  constructor(apiKey: string, baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Agent-Framework/1.0.0',
      ...defaultHeaders
    };
  }

  /**
   * Send HTTP request to LLM API
   */
  protected async makeRequest(endpoint: string, data: any): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle error responses from API
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;
    const text = await response.text();
    
    let errorMessage = text;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error?.message || errorData.message || text;
    } catch {
      // Use raw text if not JSON
    }

    switch (status) {
      case 401:
        throw new LLMError(errorMessage, 401, this.constructor.name);
      case 429:
        throw new LLMError(errorMessage, 429, this.constructor.name);
      case 404:
        throw new LLMError(errorMessage, 404, this.constructor.name);
      case 500:
      case 502:
      case 503:
        throw new LLMError(errorMessage, status, this.constructor.name);
      default:
        throw new LLMError(errorMessage, status, this.constructor.name);
    }
  }

  /**
   * Convert messages to API format
   */
  protected formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));
  }

  /**
   * Abstract method for chat completion (to be implemented by providers)
   */
  abstract chat(messages: ChatMessage[], config?: LLMRequestConfig): Promise<ChatResponse>;

  /**
   * Abstract method for streaming chat completion (to be implemented by providers)
   */
  abstract stream(messages: ChatMessage[], config?: LLMRequestConfig): AsyncIterable<StreamResponse>;

  /**
   * Abstract method for testing connection (to be implemented by providers)
   */
  abstract testConnection(): Promise<boolean>;
}