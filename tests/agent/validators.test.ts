import { describe, expect, it } from '@jest/globals';
import { AgentResultSchema, RunInputSchema } from '@/lib/agent/validators';

describe('RunInputSchema', () => {
  const base = {
    userId: 'user-123',
    command: 'optimize resume',
    resume_json: {},
  } as const;

  it('accepts minimal payload when job description is provided', () => {
    const result = RunInputSchema.safeParse({
      userId: 'user-123',
      command: 'optimize resume',
      job_description: 'Senior engineer role',
    });

    expect(result.success).toBe(true);
  });

  it('requires either job_description or job_url', () => {
    const result = RunInputSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it('accepts job_url and normalizes job_description into job_text', () => {
    const parsedFromUrl = RunInputSchema.safeParse({
      ...base,
      job_url: 'https://example.com/job',
    });
    expect(parsedFromUrl.success).toBe(true);

    const parsedFromDescription = RunInputSchema.safeParse({
      ...base,
      job_description: '  Lead TypeScript engineer  ',
    });
    expect(parsedFromDescription.success).toBe(true);
    if (parsedFromDescription.success) {
      expect(parsedFromDescription.data.job_text).toBe('Lead TypeScript engineer');
    }
  });
});

describe('AgentResultSchema', () => {
  const baseResult = () => ({
    intent: 'rewrite',
    actions: [{ tool: 'TestTool', args: {}, rationale: '' }],
    diffs: [],
    artifacts: { resume_json: {}, export_files: [] },
  });

  it('accepts valid language metadata', () => {
    const result = AgentResultSchema.safeParse({
      ...baseResult(),
      language: { lang: 'en', confidence: 0.85, rtl: false, source: 'model' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects language metadata with invalid confidence', () => {
    const result = AgentResultSchema.safeParse({
      ...baseResult(),
      language: { lang: 'en', confidence: 2, rtl: false },
    });
    expect(result.success).toBe(false);
  });

  it('fails when proposed_changes do not match schema', () => {
    const result = AgentResultSchema.safeParse({
      ...baseResult(),
      proposed_changes: [
        {
          id: 'pc-1',
          summary: 'Add metrics',
          scope: 'paragraph',
          category: 'invalid',
          confidence: 'high',
        },
      ],
    } as any);
    expect(result.success).toBe(false);
  });
});
