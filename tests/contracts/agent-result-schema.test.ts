import { describe, it, expect } from '@jest/globals';
import { AgentRuntime } from '@/lib/agent';
import { AgentResultSchema } from '@/lib/agent/validators';

describe('AgentResult schema contract: /api/agent/run', () => {
  it('validates runtime response against Zod schema', async () => {
    const runtime = new AgentRuntime();
    const result = await runtime.run({
      userId: 'contract-user',
      command: 'add skills: Kubernetes, Vercel; color #0EA5E9; font Inter; optimize',
      resume_json: {
        summary: 'Software engineer',
        contact: { name: 'A', email: 'a@b.com', phone: '', location: '' },
        skills: { technical: ['TS'], soft: [] },
        experience: [],
        education: [],
        matchScore: 0,
        keyImprovements: [],
        missingKeywords: [],
      } as any,
      job_description: 'Looking for Kubernetes and Vercel experience',
    });

    const parsed = AgentResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  }, 20000);
});

