import { describe, expect, it } from '@jest/globals';

describe('expert workflow apply response contract', () => {
  it('includes ats_impact and apply metadata fields', () => {
    const response = {
      success: true,
      updated_fields: ['summary'],
      ats_impact: {
        before: 61,
        after: 69,
        delta: 8,
      },
      apply_mode: 'default',
      selection_index: 0,
      new_ats_score: 69,
    };

    expect(typeof response.success).toBe('boolean');
    expect(Array.isArray(response.updated_fields)).toBe(true);
    expect(response.ats_impact).toBeDefined();
    expect(typeof response.apply_mode).toBe('string');
    expect(typeof response.selection_index).toBe('number');
  });
});
