import { describe, it, expect } from '@jest/globals';
import { AgentRuntime } from '@/lib/agent';

describe('Diff safety contract', () => {
  it('does not delete sections unless explicitly requested', async () => {
    const runtime = new AgentRuntime();
    const result = await runtime.run({
      userId: 'contract-user',
      command: 'strengthen experience; add skills: GraphQL; color #0EA5E9',
      resume_json: {
        summary: 'Experienced developer building APIs',
        contact: { name: 'A', email: 'a@b.com', phone: '', location: '' },
        skills: { technical: ['Node'], soft: [] },
        experience: [],
        education: [],
        matchScore: 0,
        keyImprovements: [],
        missingKeywords: [],
      } as any,
      job_description: 'Looking for backend developers with API experience',
    });

    // Safety: no deletion unless an explicit delete op (we do not emit 'op' in v1)
    const deletions = result.diffs.filter(d => (d.scope === 'section' || d.scope === 'paragraph' || d.scope === 'bullet') && d.before && !d.after);
    expect(deletions.length).toBe(0);
  }, 20000);
});

