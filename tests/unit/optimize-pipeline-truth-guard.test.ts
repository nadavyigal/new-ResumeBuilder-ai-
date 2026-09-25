/**
 * Stage 2 wiring: runOptimizePipeline runs the job-ad terms guard on the candidate it
 * is about to return, repairs once, falls back deterministically, and rescores what
 * it ships. OpenAI and the scorer are mocked, as in optimize-pipeline.test.ts.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('openai');

jest.mock('@/lib/ats/integration', () => {
  const jestGlobal = (globalThis as any).jest ?? require('@jest/globals').jest;
  return {
    __esModule: true,
    scoreOptimization: jestGlobal.fn(),
    resumeJsonToText: jestGlobal.fn((resume: any) => [resume?.summary ?? '', ...(resume?.skills?.technical ?? [])].join(' ')),
  };
});

jest.mock('@/lib/ats/extractors/jd-extractor', () => {
  const jestGlobal = (globalThis as any).jest ?? require('@jest/globals').jest;
  return { __esModule: true, extractJobData: jestGlobal.fn() };
});

import { runOptimizePipeline } from '@/lib/ai-optimizer/optimize-pipeline';
import { RESUME_OPTIMIZATION_GAP_PROMPT, RESUME_OPTIMIZATION_SYSTEM_PROMPT } from '@/lib/prompts/resume-optimizer';
import OpenAI from 'openai';
import * as atsIntegration from '@/lib/ats/integration';
import * as jdExtractorModule from '@/lib/ats/extractors/jd-extractor';

const mockScore = atsIntegration.scoreOptimization as jest.MockedFunction<typeof atsIntegration.scoreOptimization>;
const mockExtract = jdExtractorModule.extractJobData as jest.MockedFunction<typeof jdExtractorModule.extractJobData>;

const RESUME_TEXT = `Daniel Brooks
Account Executive, Peachtree Software — Apr 2021 to Present
- Closed $1.2M in new annual recurring revenue in 2025.
- Logged every opportunity in HubSpot.`;
const JD = 'Account Executive, B2B SaaS. HubSpot required. Salesforce experience preferred.';

const candidate = (skills: string[], bullet: string) => ({
  summary: 'Account executive with a record of closing new revenue.',
  contact: { name: 'Daniel Brooks', email: 'd@example.com', phone: '555', location: 'Atlanta' },
  skills: { technical: skills, soft: [] },
  experience: [
    {
      title: 'Account Executive',
      company: 'Peachtree Software',
      location: 'Atlanta',
      startDate: 'Apr 2021',
      endDate: 'Present',
      achievements: ['Closed $1.2M in new annual recurring revenue in 2025.', bullet],
    },
  ],
  education: [],
  certifications: [],
  matchScore: 80,
  keyImprovements: [],
  missingKeywords: [],
});

const CLEAN = candidate(['HubSpot'], 'Logged every opportunity in HubSpot.');
const INVENTED = candidate(['HubSpot', 'Salesforce'], 'Logged every opportunity in HubSpot, leveraging Salesforce.');

function score(original: number, optimized: number): any {
  const sub = {
    keyword_exact: 70, keyword_phrase: 70, semantic_relevance: 70, title_alignment: 70,
    metrics_presence: 70, section_completeness: 70, format_parseability: 70, recency_fit: 70,
  };
  return {
    ats_score_original: original,
    ats_score_optimized: optimized,
    subscores: { ...sub },
    subscores_original: { ...sub },
    suggestions: [],
    confidence: 0.9,
    metadata: { version: 2, scored_at: new Date(), processing_time_ms: 1, warnings: [], analyzers_used: [] },
  };
}

function openaiReturning(...responses: object[]) {
  const create = jest.fn();
  for (const r of responses) {
    create.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(r) } }], usage: {} } as never);
  }
  (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({ chat: { completions: { create } } }) as any);
  return create;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtract.mockReturnValue({ title: 'Account Executive', company: '', must_have: [], nice_to_have: [], responsibilities: [], seniority: 'mid' } as any);
  // 80 against 50: pass 1 is strong enough that pass 2 does not run.
  mockScore.mockResolvedValue(score(50, 80));
  process.env.OPENAI_API_KEY = 'sk-test';
});

describe('runOptimizePipeline with the job-ad terms guard', () => {
  it('ships a clean rewrite untouched, with no extra model call', async () => {
    const create = openaiReturning(CLEAN);
    const result = await runOptimizePipeline(RESUME_TEXT, JD);
    expect(create).toHaveBeenCalledTimes(1);
    expect(mockScore).toHaveBeenCalledTimes(1);
    expect(result.truthGuard).toMatchObject({ retried: false, removedTerms: [] });
  });

  it('repairs an invented tool once, then rescores what it ships', async () => {
    const create = openaiReturning(INVENTED, CLEAN);
    mockScore.mockResolvedValueOnce(score(50, 80)).mockResolvedValueOnce(score(50, 76));
    const result = await runOptimizePipeline(RESUME_TEXT, JD);

    expect(create).toHaveBeenCalledTimes(2);
    const repairMessages = JSON.stringify((create.mock.calls[1] as any[])[0].messages);
    expect(repairMessages).toContain('Salesforce');
    expect(result.optimizedResume.skills.technical).not.toContain('Salesforce');
    expect(result.truthGuard).toMatchObject({ retried: true, repairAccepted: true, unsupportedBefore: ['Salesforce'] });
    expect(mockScore).toHaveBeenCalledTimes(2);
    expect(result.atsResult.ats_score_optimized).toBe(76);
  });

  it('removes the tool itself when the repair still claims it', async () => {
    openaiReturning(INVENTED, INVENTED);
    const result = await runOptimizePipeline(RESUME_TEXT, JD);
    expect(result.truthGuard).toMatchObject({ repairAccepted: false, removedTerms: ['Salesforce'] });
    expect(JSON.stringify(result.optimizedResume.experience)).not.toContain('Salesforce');
    expect(result.optimizedResume.experience[0].achievements).toContain('Logged every opportunity in HubSpot.');
  });
});

describe('prompts no longer ask for keywords the résumé lacks', () => {
  it('labels missing keywords as absent from the résumé, not as things to include', () => {
    const prompt = RESUME_OPTIMIZATION_GAP_PROMPT('resume', 'job', { missingKeywords: ['Salesforce'], lowSubscores: {}, mustHave: [] });
    expect(prompt).not.toMatch(/include naturally/i);
    expect(prompt).toMatch(/not (?:found )?in the (?:original )?r[ée]sum[ée]/i);
    expect(RESUME_OPTIMIZATION_SYSTEM_PROMPT).not.toMatch(/explicitly address each one/i);
  });
});
