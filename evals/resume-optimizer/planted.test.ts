/**
 * Planted failures through the production pipeline (free, runs in `npm test`).
 *
 * Each planted output stands in for the model's answer. OpenAI and the scorer are
 * mocked, as in tests/unit/optimize-pipeline-truth-guard.test.ts, so nothing is paid
 * for. The grounding checks from the repeat eval judge both sides: the raw output must
 * be flagged, and what `runOptimizePipeline` ships must not be. Remove a guard from the
 * pipeline and its English and Hebrew cases fail here.
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

import OpenAI from 'openai';
import { runOptimizePipeline } from '@/lib/ai-optimizer/optimize-pipeline';
import * as atsIntegration from '@/lib/ats/integration';
import * as jdExtractorModule from '@/lib/ats/extractors/jd-extractor';
import { runGroundingChecks } from './grounding';
import { planted, plantedCase } from './planted';

const mockScore = atsIntegration.scoreOptimization as jest.MockedFunction<typeof atsIntegration.scoreOptimization>;
const mockExtract = jdExtractorModule.extractJobData as jest.MockedFunction<typeof jdExtractorModule.extractJobData>;

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

/** Every model call, the first pass and any repair, answers with the planted output. */
function modelAnswers(resume: object) {
  const create = jest.fn();
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(resume) } }], usage: {} } as never);
  (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({ chat: { completions: { create } } }) as any);
  return create;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtract.mockReturnValue({ title: '', company: '', must_have: [], nice_to_have: [], responsibilities: [], seniority: 'mid' } as any);
  // 80 against 50: pass 1 is strong enough that pass 2 does not run.
  mockScore.mockResolvedValue(score(50, 80));
  process.env.OPENAI_API_KEY = 'sk-test';
});

describe('planted failures: the fixtures cover what they claim', () => {
  it('has a seniority, a tool and a metric case in English and in Hebrew', () => {
    const pairs = planted.map((p) => `${p.kind}:${p.language}`).sort();
    expect(pairs).toEqual(['metric:en', 'metric:he', 'seniority:en', 'seniority:he', 'tool:en', 'tool:he']);
  });

  for (const p of planted) {
    it(`${p.id}: the raw output is flagged as ${p.category}`, () => {
      const flagged = runGroundingChecks(p.resume, plantedCase(p.caseId)).unsupported.map((u) => u.category);
      expect(flagged).toContain(p.category);
    });
  }
});

describe('planted failures: what the pipeline ships is clean', () => {
  for (const p of planted) {
    it(`${p.id}: ${p.guard} takes out "${p.planted}"`, async () => {
      const c = plantedCase(p.caseId);
      modelAnswers(p.resume);
      const result = await runOptimizePipeline(c.resumeText, c.jobDescription);

      expect(runGroundingChecks(result.optimizedResume, c).unsupported).toEqual([]);
      expect(JSON.stringify(result.optimizedResume)).not.toContain(p.planted);
      // Nothing left hanging where the claim was: no "ב-." or "by ." in a bullet.
      const bullets = result.optimizedResume.experience.flatMap((e) => e.achievements);
      expect(bullets.filter((b) => /(?:^|\s)(?:[בלמ]-|by|to)\s*[.,;]?$/.test(b))).toEqual([]);
    });
  }
});
