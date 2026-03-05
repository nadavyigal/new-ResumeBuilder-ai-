/**
 * AI Request Queue
 *
 * Phase 7: T050 - Request queuing for AI operations to handle concurrent sessions (50+ users)
 *
 * Features:
 * - In-memory queue for AI operations
 * - Concurrent request limiting
 * - Priority-based execution
 * - Timeout handling
 * - Queue statistics and monitoring
 *
 * Production considerations:
 * - For multi-instance deployments, use BullMQ with Redis
 * - For serverless, consider AWS SQS or Google Cloud Tasks
 */

import { createLogger } from '../agent/utils/logger';

const logger = createLogger({ component: 'ai-queue' });

/**
 * Queue item representing an AI request
 */
interface QueueItem<T> {
  id: string;
  priority: number; // Higher = more important
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  createdAt: number;
  timeout?: number; // Optional timeout in ms
}

/**
 * Queue statistics
 */
export interface QueueStats {
  queueSize: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageWaitTime: number; // ms
  averageProcessTime: number; // ms
}

/**
 * AI Request Queue Configuration
 */
export interface QueueConfig {
  /**
   * Maximum number of concurrent AI requests
   * Default: 5 (to avoid rate limits and manage costs)
   */
  maxConcurrent: number;

  /**
   * Default timeout for requests (ms)
   * Default: 30 seconds
   */
  defaultTimeout: number;

  /**
   * Enable detailed logging
   */
  enableLogging: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 5,
  defaultTimeout: 30000,
  enableLogging: process.env.NODE_ENV === 'development',
};

/**
 * AI Request Queue class
 */
export class AIRequestQueue {
  private queue: QueueItem<any>[] = [];
  private activeRequests = 0;
  private completedRequests = 0;
  private failedRequests = 0;
  private waitTimes: number[] = [];
  private processTimes: number[] = [];
  private config: QueueConfig;
  private requestCounter = 0;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enableLogging) {
      logger.info('AI Request Queue initialized', {
        maxConcurrent: this.config.maxConcurrent,
        defaultTimeout: this.config.defaultTimeout,
      });
    }
  }

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    priority: number = 0,
    timeout?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `req-${++this.requestCounter}`;
      const item: QueueItem<T> = {
        id,
        priority,
        execute,
        resolve,
        reject,
        createdAt: Date.now(),
        timeout: timeout || this.config.defaultTimeout,
      };

      // Insert in priority order (higher priority first)
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }

      if (this.config.enableLogging) {
        logger.debug(`Request queued: ${id}`, {
          queueSize: this.queue.length,
          priority,
        });
      }

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    if (this.activeRequests >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get next item from queue
    const item = this.queue.shift();
    if (!item) return;

    this.activeRequests++;

    const waitTime = Date.now() - item.createdAt;
    this.waitTimes.push(waitTime);

    // Keep only last 100 wait times
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift();
    }

    if (this.config.enableLogging) {
      logger.info(`Processing request: ${item.id}`, {
        waitTime,
        queueSize: this.queue.length,
        activeRequests: this.activeRequests,
      });
    }

    const processStart = Date.now();

    try {
      // Set up timeout
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (item.timeout) {
          timeoutId = setTimeout(() => {
            reject(new Error(`Request timeout after ${item.timeout}ms`));
          }, item.timeout);
        }
      });

      // Race between execution and timeout
      const result = await Promise.race([
        item.execute(),
        ...(item.timeout ? [timeoutPromise] : []),
      ]);

      // Clear timeout if set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const processTime = Date.now() - processStart;
      this.processTimes.push(processTime);

      // Keep only last 100 process times
      if (this.processTimes.length > 100) {
        this.processTimes.shift();
      }

      this.completedRequests++;
      item.resolve(result);

      if (this.config.enableLogging) {
        logger.info(`Request completed: ${item.id}`, {
          processTime,
          completedRequests: this.completedRequests,
        });
      }
    } catch (error) {
      this.failedRequests++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Request failed: ${item.id}`, {
        failedRequests: this.failedRequests,
        error: errorMessage,
      }, error);

      item.reject(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      this.activeRequests--;

      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const avgWaitTime = this.waitTimes.length > 0
      ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
      : 0;

    const avgProcessTime = this.processTimes.length > 0
      ? this.processTimes.reduce((a, b) => a + b, 0) / this.processTimes.length
      : 0;

    return {
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      averageWaitTime: Math.round(avgWaitTime),
      averageProcessTime: Math.round(avgProcessTime),
    };
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    const count = this.queue.length;

    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });

    this.queue = [];

    logger.info(`Queue cleared: ${count} requests cancelled`);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.completedRequests = 0;
    this.failedRequests = 0;
    this.waitTimes = [];
    this.processTimes = [];

    logger.info('Queue statistics reset');
  }
}

/**
 * Global queue instance for AI operations
 * Singleton pattern to share across all API routes
 */
let globalQueue: AIRequestQueue | null = null;

/**
 * Get or create the global AI request queue
 */
export function getAIQueue(config?: Partial<QueueConfig>): AIRequestQueue {
  if (!globalQueue) {
    globalQueue = new AIRequestQueue(config);
  }

  return globalQueue;
}

/**
 * Enqueue an AI operation
 *
 * Usage:
 * ```typescript
 * const result = await enqueueAIRequest(
 *   () => openai.chat.completions.create({ ... }),
 *   1 // priority (optional)
 * );
 * ```
 */
export async function enqueueAIRequest<T>(
  execute: () => Promise<T>,
  priority: number = 0,
  timeout?: number
): Promise<T> {
  const queue = getAIQueue();
  return queue.enqueue(execute, priority, timeout);
}

/**
 * Get queue statistics
 */
export function getQueueStats(): QueueStats {
  const queue = getAIQueue();
  return queue.getStats();
}

/**
 * Priority levels for common operations
 */
export const PRIORITIES = {
  /**
   * Critical operations (user is waiting)
   */
  CRITICAL: 10,

  /**
   * High priority (interactive operations)
   */
  HIGH: 5,

  /**
   * Normal priority (default)
   */
  NORMAL: 0,

  /**
   * Low priority (background operations)
   */
  LOW: -5,

  /**
   * Batch operations
   */
  BATCH: -10,
} as const;

/**
 * Example usage:
 *
 * ```typescript
 * import { enqueueAIRequest, PRIORITIES } from '@/lib/queue/ai-request-queue';
 *
 * // In your API route:
 * const response = await enqueueAIRequest(
 *   () => openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   }),
 *   PRIORITIES.HIGH,
 *   30000 // 30 second timeout
 * );
 * ```
 */
