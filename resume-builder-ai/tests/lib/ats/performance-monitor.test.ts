/**
 * Unit Tests for ATS Performance Monitor
 * Phase 5, Task T035
 */

import { PerformanceMonitor } from '../../../src/lib/ats/performance-monitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('track()', () => {
    it('tracks successful operations', async () => {
      const result = await monitor.track('test-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');

      const stats = monitor.getStats('test-operation');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.min).toBeGreaterThanOrEqual(10);
    });

    it('tracks failed operations', async () => {
      await expect(
        monitor.track('failing-operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const stats = monitor.getStats('failing-operation');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
    });

    it('includes metadata in metrics', async () => {
      await monitor.track(
        'metadata-test',
        async () => 'done',
        { userId: '123', type: 'rescoring' }
      );

      const recent = monitor.getRecentMetrics(1);
      expect(recent[0].metadata).toMatchObject({
        userId: '123',
        type: 'rescoring',
      });
    });

    it('warns when operation exceeds 2 seconds', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await monitor.track('slow-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 2100));
        return 'done';
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow slow-operation')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getStats()', () => {
    beforeEach(async () => {
      // Add sample metrics
      await monitor.track('op1', async () => new Promise((r) => setTimeout(r, 100)));
      await monitor.track('op1', async () => new Promise((r) => setTimeout(r, 200)));
      await monitor.track('op1', async () => new Promise((r) => setTimeout(r, 300)));
      await monitor.track('op2', async () => new Promise((r) => setTimeout(r, 50)));
    });

    it('calculates statistics correctly', () => {
      const stats = monitor.getStats('op1');

      expect(stats).toBeDefined();
      expect(stats?.count).toBe(3);
      expect(stats?.min).toBeGreaterThanOrEqual(100);
      expect(stats?.max).toBeGreaterThanOrEqual(300);
      expect(stats?.avg).toBeGreaterThan(100);
    });

    it('filters by operation name', () => {
      const op1Stats = monitor.getStats('op1');
      const op2Stats = monitor.getStats('op2');

      expect(op1Stats?.count).toBe(3);
      expect(op2Stats?.count).toBe(1);
    });

    it('returns all stats when no operation specified', () => {
      const allStats = monitor.getStats();

      expect(allStats?.count).toBe(4); // 3 from op1 + 1 from op2
    });

    it('returns null when no metrics exist', () => {
      const newMonitor = new PerformanceMonitor();
      const stats = newMonitor.getStats('nonexistent');

      expect(stats).toBeNull();
    });
  });

  describe('validateSLA()', () => {
    it('passes when p95 < 2000ms', async () => {
      // Add 100 fast operations
      for (let i = 0; i < 100; i++) {
        await monitor.track('fast-op', async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 100));
        });
      }

      const sla = monitor.validateSLA('fast-op');

      expect(sla.passes).toBe(true);
      expect(sla.p95).toBeLessThan(2000);
      expect(sla.message).toContain('✅');
    });

    it('fails when p95 >= 2000ms', async () => {
      // Add operations where >5% exceed 2000ms
      // Need more samples to ensure p95 is high
      for (let i = 0; i < 100; i++) {
        const delay = i < 94 ? 100 : 2500; // Last 6 are slow (6% > 5%)
        await monitor.track('mixed-op', async () => {
          await new Promise((r) => setTimeout(r, delay));
        });
      }

      const sla = monitor.validateSLA('mixed-op');

      expect(sla.passes).toBe(false);
      expect(sla.p95).toBeGreaterThanOrEqual(2000);
      expect(sla.message).toContain('❌');
    });

    it('returns failure when no metrics available', () => {
      const sla = monitor.validateSLA('nonexistent');

      expect(sla.passes).toBe(false);
      expect(sla.message).toContain('No metrics');
    });
  });

  describe('percentile calculation', () => {
    it('calculates p50 correctly', async () => {
      // Add metrics: 100, 200, 300, 400, 500
      for (let i = 1; i <= 5; i++) {
        await monitor.track('percentile-test', async () => {
          await new Promise((r) => setTimeout(r, i * 100));
        });
      }

      const stats = monitor.getStats('percentile-test');

      expect(stats?.p50).toBeGreaterThanOrEqual(300);
      expect(stats?.p50).toBeLessThan(400);
    });

    it('calculates p95 correctly', async () => {
      // Add 100 metrics
      for (let i = 1; i <= 100; i++) {
        await monitor.track('p95-test', async () => {
          await new Promise((r) => setTimeout(r, i));
        });
      }

      const stats = monitor.getStats('p95-test');

      // p95 should be around 95th value (allowing for overhead)
      expect(stats?.p95).toBeGreaterThanOrEqual(90);
      expect(stats?.p95).toBeLessThanOrEqual(120); // Allow overhead
    });
  });

  describe('getRecentMetrics()', () => {
    beforeEach(async () => {
      for (let i = 0; i < 20; i++) {
        await monitor.track('recent-test', async () => i);
      }
    });

    it('returns last N metrics', () => {
      const recent = monitor.getRecentMetrics(5);

      expect(recent.length).toBe(5);
    });

    it('defaults to last 10 metrics', () => {
      const recent = monitor.getRecentMetrics();

      expect(recent.length).toBe(10);
    });

    it('returns metrics in chronological order', () => {
      const recent = monitor.getRecentMetrics(3);

      expect(recent[0].timestamp.getTime()).toBeLessThanOrEqual(
        recent[1].timestamp.getTime()
      );
      expect(recent[1].timestamp.getTime()).toBeLessThanOrEqual(
        recent[2].timestamp.getTime()
      );
    });
  });

  describe('clear()', () => {
    it('removes all metrics', async () => {
      await monitor.track('test', async () => 'done');

      expect(monitor.getStats()).not.toBeNull();

      monitor.clear();

      expect(monitor.getStats()).toBeNull();
    });
  });

  describe('generateReport()', () => {
    beforeEach(async () => {
      await monitor.track('op1', async () => new Promise((r) => setTimeout(r, 100)));
      await monitor.track('op1', async () => new Promise((r) => setTimeout(r, 200)));
      await monitor.track('op2', async () => new Promise((r) => setTimeout(r, 50)));
    });

    it('generates formatted report', () => {
      const report = monitor.generateReport();

      expect(report).toContain('ATS Performance Report');
      expect(report).toContain('op1');
      expect(report).toContain('op2');
      expect(report).toContain('Count:');
      expect(report).toContain('p95:');
    });

    it('includes SLA indicators', () => {
      const report = monitor.generateReport();

      // Both operations should pass (< 2000ms)
      expect(report).toContain('✅');
    });
  });

  describe('metric retention', () => {
    it('keeps only last 1000 metrics', async () => {
      // Add 1500 metrics
      for (let i = 0; i < 1500; i++) {
        await monitor.track('retention-test', async () => i);
      }

      const stats = monitor.getStats('retention-test');

      expect(stats?.count).toBe(1000);
    });
  });
});
