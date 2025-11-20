/**
 * ATS Performance Monitoring Utility
 * Phase 5, Task T035
 *
 * Tracks and validates ATS rescoring performance metrics
 * Target: p95 latency < 2 seconds
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 measurements

  /**
   * Track a timed operation
   */
  async track<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;

    try {
      const result = await fn();
      success = true;
      return result;
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      const duration = Date.now() - startTime;
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date(),
        success,
        metadata: {
          ...metadata,
          error: error?.message,
        },
      });
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log warning if operation is slow
    if (metric.duration > 2000) {
      console.warn(
        `⚠️ [Performance] Slow ${metric.operation}: ${metric.duration}ms (target: <2000ms)`
      );
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getStats(operation?: string): PerformanceStats | null {
    const relevantMetrics = operation
      ? this.metrics.filter((m) => m.operation === operation)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return null;
    }

    const durations = relevantMetrics
      .map((m) => m.duration)
      .sort((a, b) => a - b);

    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: Math.round(sum / durations.length),
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Check if performance meets SLA (p95 < 2 seconds)
   */
  validateSLA(operation?: string): {
    passes: boolean;
    p95: number;
    message: string;
  } {
    const stats = this.getStats(operation);

    if (!stats) {
      return {
        passes: false,
        p95: 0,
        message: 'No metrics available',
      };
    }

    const passes = stats.p95 < 2000;

    return {
      passes,
      p95: stats.p95,
      message: passes
        ? `✅ Performance SLA met: p95=${stats.p95}ms (target: <2000ms)`
        : `❌ Performance SLA violated: p95=${stats.p95}ms (target: <2000ms)`,
    };
  }

  /**
   * Get recent metrics (last N)
   */
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const operations = Array.from(
      new Set(this.metrics.map((m) => m.operation))
    );

    let report = '📊 ATS Performance Report\n';
    report += '=' .repeat(50) + '\n\n';

    for (const operation of operations) {
      const stats = this.getStats(operation);
      if (!stats) continue;

      const sla = this.validateSLA(operation);

      report += `Operation: ${operation}\n`;
      report += `  Count: ${stats.count}\n`;
      report += `  Avg: ${stats.avg}ms\n`;
      report += `  p50: ${stats.p50}ms\n`;
      report += `  p95: ${stats.p95}ms ${sla.passes ? '✅' : '❌'}\n`;
      report += `  p99: ${stats.p99}ms\n`;
      report += `  Range: ${stats.min}ms - ${stats.max}ms\n\n`;
    }

    return report;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetric, PerformanceStats };
