import { describe, it, expect } from '@jest/globals';

// This is a smoke test stub to validate shape, not to perform network calls.
// It directly imports the runtime and runs it with dummy data.

import { AgentRuntime } from '@/lib/agent';

describe('POST /api/agent/run (runtime smoke)', () => {
  it('returns AgentResult shape with actions, diffs, artifacts, ats_report', async () => {
    const runtime = new AgentRuntime();
    const job_url = 'https://example.com/job/123';
    const result = await runtime.run({
      userId: 'test-user',
      command: 'Strengthen Experience at Acme; add skills: Kubernetes, Vercel; change font Inter; color #0EA5E9; optimize for job',
      resume_json: {
        summary: 'Worked at Acme building great products.',
        contact: { name: 'John Doe', email: 'john@example.com', phone: '', location: '' },
        skills: { technical: ['React'], soft: [] },
        experience: [],
        education: [],
        matchScore: 0,
        keyImprovements: [],
        missingKeywords: [],
      } as any,
      job_url,
    });

    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
    expect(Array.isArray(result.diffs)).toBe(true);
    // expect at least one style diff
    expect(result.diffs.some(d => d.scope === 'style')).toBe(true);
    expect(result.ats_report && typeof result.ats_report.score === 'number').toBe(true);
    expect(result.artifacts).toBeDefined();
  }, 20000);
});

