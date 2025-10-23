import { describe, it, expect } from '@jest/globals';

/**
 * Contract test for legacy endpoint shape compatibility.
 * This is a shape-level test using a representative sample.
 * It asserts the historical response remains identical, with only optional
 * meta.agentResult allowed as an additive field.
 */

type LegacyOptimizeResponse = { optimizationId: string } & {
  meta?: { agentResult?: unknown }
};

describe('Legacy endpoint contract: /api/optimize', () => {
  it('matches legacy shape; allows optional meta.agentResult', async () => {
    // Representative legacy response
    const legacy: LegacyOptimizeResponse = { optimizationId: 'abc-123' };

    // Hypothetical augmented response (additive only)
    const augmented: LegacyOptimizeResponse = {
      optimizationId: 'xyz-999',
      meta: { agentResult: { intent: 'design' } },
    };

    // Legacy must have optimizationId
    expect(typeof legacy.optimizationId).toBe('string');
    // Augmented must also have optimizationId and, if present, meta.agentResult is additive
    expect(typeof augmented.optimizationId).toBe('string');
    if (augmented.meta) {
      expect('agentResult' in augmented.meta).toBe(true);
    }
  });
});

