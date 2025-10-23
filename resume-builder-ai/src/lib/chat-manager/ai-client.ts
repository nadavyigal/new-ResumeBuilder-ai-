/**
 * AI Client Module
 *
 * OpenAI GPT-4 integration for chat-based resume amendments.
 * Supports streaming responses via Server-Sent Events.
 * Includes retry logic, timeout handling, and rate limit management.
 */

import OpenAI from 'openai';

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number; // Request timeout in milliseconds
  maxRetries?: number; // Maximum retry attempts
}

export interface ChatCompletionOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream?: boolean;
  retryAttempt?: number; // Internal: current retry attempt
}

/**
 * Custom error types for better error handling
 */
export class AIClientError extends Error {
  constructor(message: string, public code: string, public retryable: boolean = false) {
    super(message);
    this.name = 'AIClientError';
  }
}

export class AITimeoutError extends AIClientError {
  constructor(message: string = 'AI request timed out') {
    super(message, 'TIMEOUT', true);
    this.name = 'AITimeoutError';
  }
}

export class AIRateLimitError extends AIClientError {
  constructor(message: string = 'Rate limit exceeded', public retryAfter?: number) {
    super(message, 'RATE_LIMIT', true);
    this.name = 'AIRateLimitError';
  }
}

export class AIQuotaError extends AIClientError {
  constructor(message: string = 'API quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', false);
    this.name = 'AIQuotaError';
  }
}

/**
 * Create OpenAI client instance
 *
 * @param config - AI client configuration
 * @returns Configured OpenAI client
 */
export function createAIClient(config: AIClientConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
  });
}

/**
 * Stream chat response using Server-Sent Events
 *
 * @param client - OpenAI client instance
 * @param options - Chat completion options
 * @returns Async generator for streaming response
 */
export async function* streamChatResponse(
  client: OpenAI,
  options: ChatCompletionOptions
): AsyncGenerator<string, void, unknown> {
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: options.messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * Get non-streaming chat response with retry and timeout logic
 *
 * @param client - OpenAI client instance
 * @param options - Chat completion options
 * @param config - Client configuration with timeout and retry settings
 * @returns Complete AI response
 */
export async function getChatResponse(
  client: OpenAI,
  options: ChatCompletionOptions,
  config?: AIClientConfig
): Promise<string> {
  const maxRetries = config?.maxRetries ?? 3;
  const timeout = config?.timeout ?? 20000; // 20 seconds default
  const retryAttempt = options.retryAttempt ?? 0;

  try {
    // Wrap request in timeout promise
    const completion = await Promise.race([
      client.chat.completions.create({
        model: config?.model ?? 'gpt-4',
        messages: options.messages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxTokens ?? 1000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AITimeoutError()), timeout)
      ),
    ]);

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    // Handle timeout
    if (error instanceof AITimeoutError) {
      if (retryAttempt < maxRetries) {
        console.warn(`AI request timed out, retrying (${retryAttempt + 1}/${maxRetries})...`);
        return getChatResponse(client, { ...options, retryAttempt: retryAttempt + 1 }, config);
      }
      throw error;
    }

    // Handle rate limits
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after']
        ? parseInt(error.headers['retry-after']) * 1000
        : 2000; // Default 2 seconds

      if (retryAttempt < maxRetries) {
        console.warn(`Rate limit hit, retrying after ${retryAfter}ms (${retryAttempt + 1}/${maxRetries})...`);
        await sleep(retryAfter);
        return getChatResponse(client, { ...options, retryAttempt: retryAttempt + 1 }, config);
      }

      throw new AIRateLimitError('Rate limit exceeded after retries', retryAfter);
    }

    // Handle quota exceeded
    if (error.status === 402 || error.code === 'insufficient_quota') {
      throw new AIQuotaError('OpenAI API quota exceeded. Please check your billing settings.');
    }

    // Handle network errors (retryable)
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      if (retryAttempt < maxRetries) {
        console.warn(`Network error, retrying (${retryAttempt + 1}/${maxRetries})...`);
        await sleep(1000 * (retryAttempt + 1)); // Exponential backoff
        return getChatResponse(client, { ...options, retryAttempt: retryAttempt + 1 }, config);
      }
      throw new AIClientError('Network error after retries: ' + error.message, 'NETWORK_ERROR', false);
    }

    // Handle other OpenAI errors
    if (error.status === 500 || error.status === 503) {
      if (retryAttempt < maxRetries) {
        console.warn(`Server error (${error.status}), retrying (${retryAttempt + 1}/${maxRetries})...`);
        await sleep(2000 * (retryAttempt + 1)); // Exponential backoff
        return getChatResponse(client, { ...options, retryAttempt: retryAttempt + 1 }, config);
      }
      throw new AIClientError('OpenAI server error after retries', 'SERVER_ERROR', false);
    }

    // Re-throw unknown errors
    throw new AIClientError(
      error.message || 'Unknown AI client error',
      error.code || 'UNKNOWN',
      false
    );
  }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build system prompt for resume amendment context
 */
export function buildSystemPrompt(resumeContext: Record<string, unknown>): string {
  return `You are an AI assistant helping users refine their resume through conversational amendments.

Current resume context:
${JSON.stringify(resumeContext, null, 2)}

Guidelines:
- Only suggest changes based on existing resume content
- NEVER fabricate experience, skills, or qualifications
- Ask clarifying questions when requests are ambiguous
- Maintain professional tone and ATS-friendly formatting
- Provide specific, actionable suggestions`;
}
