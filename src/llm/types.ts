/**
 * Message types for LLM conversations
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/**
 * Response from LLM API
 */
export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Streaming response chunk
 */
export interface StreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Configuration for LLM requests
 */
export interface LLMRequestConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

/**
 * Base interface for LLM clients
 */
export interface LLMClient {
  /**
   * Send chat completion request
   */
  chat(messages: ChatMessage[], config?: LLMRequestConfig): Promise<ChatResponse>;
  
  /**
   * Send streaming chat completion request
   */
  stream(messages: ChatMessage[], config?: LLMRequestConfig): AsyncIterable<StreamResponse>;
  
  /**
   * Test client connectivity
   */
  testConnection(): Promise<boolean>;
}

/**
 * Error types for LLM operations
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
    public readonly model?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class RateLimitError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 429, provider);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends LLMError {
  constructor(message: string, provider?: string) {
    super(message, 401, provider);
    this.name = 'AuthenticationError';
  }
}

export class ModelNotFoundError extends LLMError {
  constructor(model: string, provider?: string) {
    super(`Model not found: ${model}`, 404, provider, model);
    this.name = 'ModelNotFoundError';
  }
}