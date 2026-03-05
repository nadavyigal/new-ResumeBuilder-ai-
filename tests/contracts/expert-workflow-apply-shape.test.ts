import { describe, expect, it } from '@jest/globals';

describe('expert workflow apply response contract', () => {
  it('includes ats_impact and apply metadata fields', () => {
    const response = {
      success: true,
      workflow_type: 'full_resume_rewrite',
      updated_fields: ['summary'],
      ats_impact: {
        before: 61,
        after: 69,
        delta: 8,
      },
      apply_mode: 'default',
      selection_index: 0,
      applied_assets: [],
      new_ats_score: 69,
    };

    expect(typeof response.success).toBe('boolean');
    expect(typeof response.workflow_type).toBe('string');
    expect(Array.isArray(response.updated_fields)).toBe(true);
    expect(response.ats_impact).toBeDefined();
    expect(typeof response.apply_mode).toBe('string');
    expect(typeof response.selection_index).toBe('number');
    expect(Array.isArray(response.applied_assets)).toBe(true);
  });

  it('supports null-safe ATS impact for non-resume workflows', () => {
    const response = {
      success: true,
      workflow_type: 'cover_letter_architect',
      updated_fields: [],
      ats_impact: {
        before: null,
        after: null,
        delta: null,
      },
      apply_mode: 'select_cover_letter_variant',
      selection_index: 1,
      applied_assets: ['cover_letter_variant:1'],
      new_ats_score: null,
    };

    expect(response.ats_impact.before).toBeNull();
    expect(response.ats_impact.after).toBeNull();
    expect(response.ats_impact.delta).toBeNull();
    expect(response.applied_assets[0]).toContain('cover_letter_variant');
  });
});
