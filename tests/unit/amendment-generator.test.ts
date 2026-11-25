/**
 * Amendment generator after the prompt upgrade (S6): no expansion map, every
 * added skill must already be in the resume, and an empty answer does not fall
 * into the keyword heuristic.
 */
const create = jest.fn();
jest.mock('openai', () => jest.fn().mockImplementation(() => ({ chat: { completions: { create } } })));

import {
  AMENDMENT_SYSTEM_PROMPT,
  generateAmendments,
  groundAffectedFields,
} from '@/lib/ats/amendment-generator';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { Suggestion } from '@/lib/ats/types';

const resume = {
  summary: 'Backend developer building REST APIs in Node.js.',
  contact: { name: 'A', email: '', phone: '', location: '' },
  skills: { technical: ['Node.js', 'PostgreSQL'], soft: [] },
  experience: [
    { title: 'Developer', company: 'Acme', location: '', startDate: '2021', endDate: 'Present', achievements: ['Deployed services with Docker on cloud servers.'] },
  ],
  education: [],
  matchScore: 0,
  keyImprovements: [],
  missingKeywords: [],
} as unknown as OptimizedResume;

const addCloud: Suggestion = {
  id: 's1',
  text: 'add cloud',
  estimated_gain: 6,
  targets: ['skills'],
  quick_win: true,
  category: 'keywords',
  action: { type: 'add_keyword', params: { keywords: ['cloud'] } },
} as unknown as Suggestion;

function reply(fields: unknown) {
  return { choices: [{ message: { content: JSON.stringify({ affectedFields: fields }) }, finish_reason: 'stop' }], usage: {} };
}

beforeEach(() => {
  create.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

describe('amendment prompt', () => {
  it('has no expansion map, no shouting and allows an empty answer', () => {
    expect(AMENDMENT_SYSTEM_PROMPT).not.toMatch(/AWS|CRITICAL|❌|✅/);
    expect(AMENDMENT_SYSTEM_PROMPT).toContain('{"affectedFields": []}');
    expect(AMENDMENT_SYSTEM_PROMPT).toContain('# Truth rules');
  });

  it('labels the points as an estimate and tags the data', async () => {
    create.mockResolvedValueOnce(reply([]));
    await generateAmendments(addCloud, resume, { jobDescriptionText: 'Cloud engineer, AWS' });
    const user = create.mock.calls[0][0].messages[1].content as string;
    expect(user).toContain('Estimated impact (rough estimate): +6 points');
    expect(user).toContain('<current_resume_json>');
    expect(user).toContain('<job_posting>');
  });
});

describe('"add cloud" on a resume without AWS', () => {
  it('model path: drops AWS and Azure the model tries to add', async () => {
    create.mockResolvedValueOnce(
      reply([{ sectionId: 'skills', field: 'technical', originalValue: ['Node.js', 'PostgreSQL'], newValue: ['Node.js', 'PostgreSQL', 'AWS', 'Azure', 'Docker'], changeType: 'modify', reason: 'r' }])
    );
    const out = await generateAmendments(addCloud, resume);
    const added = JSON.stringify(out.affectedFields);
    expect(added).not.toContain('AWS');
    expect(added).not.toContain('Azure');
    expect(added).toContain('Docker'); // in the resume's bullet, so allowed
  });

  it('empty model answer: no heuristic, flagged as no truthful edit', async () => {
    create.mockResolvedValueOnce(reply([]));
    const out = await generateAmendments(addCloud, resume);
    expect(out.affectedFields).toEqual([]);
    expect(out.noTruthfulEdit).toBe(true);
    expect(out.success).toBe(true);
  });

  it('heuristic path (model error): adds neither AWS nor Azure', async () => {
    create.mockRejectedValueOnce(new Error('network'));
    const out = await generateAmendments(addCloud, resume);
    const added = JSON.stringify(out.affectedFields);
    expect(added).not.toContain('AWS');
    expect(added).not.toContain('Azure');
  });

  it('every model addition unsupported: flagged, not padded by the heuristic', async () => {
    create.mockResolvedValueOnce(
      reply([{ sectionId: 'skills', field: 'technical', originalValue: ['Node.js'], newValue: ['Node.js', 'Kubernetes'], changeType: 'modify', reason: 'r' }])
    );
    const out = await generateAmendments(addCloud, resume);
    expect(out.affectedFields).toEqual([]);
    expect(out.noTruthfulEdit).toBe(true);
  });
});

describe('groundAffectedFields', () => {
  it('keeps existing items and supported additions, drops the rest, leaves bullets alone', () => {
    const fields = groundAffectedFields(
      [
        { sectionId: 'skills', field: 'technical', originalValue: ['Node.js'], newValue: ['Node.js', 'REST APIs', 'GraphQL'], changeType: 'modify' },
        { sectionId: 'experience-0', field: 'achievements', originalValue: ['x'], newValue: ['y'], changeType: 'modify' },
      ] as any,
      resume
    );
    expect(fields[0].newValue).toEqual(['Node.js', 'REST APIs']);
    expect(fields[1].newValue).toEqual(['y']);
  });
});

describe('review follow-ups', () => {
  it('an unknown response shape whose heuristic finds nothing is flagged as no truthful edit', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: '{"something":"else"}' }, finish_reason: 'stop' }], usage: {} });
    const out = await generateAmendments({ ...addCloud, action: undefined, category: 'formatting' } as any, resume);
    expect(out.affectedFields).toEqual([]);
    expect(out.noTruthfulEdit).toBe(true);
  });
});
