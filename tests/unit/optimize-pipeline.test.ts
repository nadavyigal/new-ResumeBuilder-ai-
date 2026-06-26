/**
 * Unit tests for optimize-pipeline.ts and ATS honest-scoring behaviour.
 *
 * External dependencies are fully mocked so no real OpenAI or ATS calls occur.
 */

// NOTE: When using @jest/globals, jest.mock() factory callbacks run at hoist
// time before the import for `jest` from '@jest/globals' is resolved.
// We therefore use global `jest` (always available inside Jest runtime) inside
// factory functions, and import `jest` from '@jest/globals' only for
// the test-body helpers (expect, describe, it, beforeEach).

/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Module mocks — declared before all other imports so Jest hoists them.
// Factory functions intentionally use the global `jest` object.
// ---------------------------------------------------------------------------
jest.mock('openai');

jest.mock('@/lib/ats/integration', () => {
  const jestGlobal = (globalThis as any).jest ?? require('@jest/globals').jest;
  return {
    __esModule: true,
    scoreOptimization: jestGlobal.fn(),
    resumeJsonToText: jestGlobal.fn((resume: any) =>
      [
        resume?.contact?.name ?? '',
        resume?.summary ?? '',
        ...(resume?.skills?.technical ?? []),
      ].join(' ')
    ),
    extractJobRequirements: jestGlobal.fn(),
    generateFormatReport: jestGlobal.fn(() => ({
      has_tables: false,
      has_images: false,
      has_headers_footers: false,
      has_nonstandard_fonts: false,
      has_odd_glyphs: false,
      has_multi_column: false,
      format_safety_score: 85,
      issues: [],
    })),
  };
});

jest.mock('@/lib/ats/extractors/jd-extractor', () => {
  const jestGlobal = (globalThis as any).jest ?? require('@jest/globals').jest;
  return {
    __esModule: true,
    extractJobData: jestGlobal.fn(),
    isJobExtractionComplete: jestGlobal.fn(() => ({
      isComplete: true,
      completeness: 1,
      missingFields: [],
    })),
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { runOptimizePipeline, stripFabricatedMetrics } from '@/lib/ai-optimizer/optimize-pipeline';
import OpenAI from 'openai';
import * as atsIntegration from '@/lib/ats/integration';
import * as jdExtractorModule from '@/lib/ats/extractors/jd-extractor';
import * as atsModule from '@/lib/ats';

// ---------------------------------------------------------------------------
// Typed helpers for cast-safe mock access
// ---------------------------------------------------------------------------
// Cast to jest.MockedFunction after verifying they are jest.fn() instances at runtime
const mockScoreOptimization = atsIntegration.scoreOptimization as jest.MockedFunction<
  typeof atsIntegration.scoreOptimization
>;
const mockExtractJobData = jdExtractorModule.extractJobData as jest.MockedFunction<
  typeof jdExtractorModule.extractJobData
>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Minimal valid OptimizedResume JSON that the pipeline expects */
const makeResumeJson = (overrides: Partial<{ summary: string; matchScore: number }> = {}) => ({
  summary: overrides.summary ?? 'Experienced engineer',
  contact: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    location: 'NYC',
  },
  skills: {
    technical: ['JavaScript', 'React'],
    soft: ['Communication'],
  },
  experience: [
    {
      title: 'Engineer',
      company: 'Acme',
      location: 'NYC',
      startDate: 'Jan 2020',
      endDate: 'Present',
      achievements: ['Built systems'],
    },
  ],
  education: [
    {
      degree: 'BS Computer Science',
      institution: 'MIT',
      location: 'Cambridge MA',
      graduationDate: '2019',
    },
  ],
  matchScore: overrides.matchScore ?? 75,
  keyImprovements: ['Added keywords'],
  missingKeywords: [],
});

const RESUME_JSON_PASS1 = makeResumeJson({ summary: 'Pass 1 engineer', matchScore: 75 });
const RESUME_JSON_PASS2 = makeResumeJson({ summary: 'Pass 2 engineer', matchScore: 80 });

const defaultSubscores = {
  keyword_exact: 70,
  keyword_phrase: 70,
  semantic_relevance: 70,
  title_alignment: 70,
  metrics_presence: 70,
  section_completeness: 70,
  format_parseability: 70,
  recency_fit: 70,
};

/** Build an ATSScoreOutput fixture */
function makeAtsScore(
  atsScoreOriginal: number,
  atsScoreOptimized: number,
  suggestions: any[] = []
): any {
  return {
    ats_score_original: atsScoreOriginal,
    ats_score_optimized: atsScoreOptimized,
    subscores: { ...defaultSubscores },
    subscores_original: { ...defaultSubscores },
    suggestions,
    confidence: 0.85,
    metadata: {
      version: 2,
      scored_at: new Date(),
      processing_time_ms: 100,
      warnings: [],
      analyzers_used: [],
    },
  };
}

/** Build the OpenAI mock instance with a controllable create function */
function buildOpenAIMock(responseJson: object = RESUME_JSON_PASS1) {
  const createMock = jest.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify(responseJson),
        },
      },
    ],
  } as any);

  const mockInstance = {
    chat: {
      completions: {
        create: createMock,
      },
    },
  };

  (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

  return { mockInstance, createMock };
}

/** Default JD extraction return value */
const DEFAULT_JD_EXTRACTION: any = {
  title: 'Software Engineer',
  company: '',
  must_have: ['React', 'TypeScript', 'Node.js'],
  nice_to_have: ['AWS'],
  responsibilities: [],
  seniority: 'mid',
};

// ---------------------------------------------------------------------------
// Suite 1: runOptimizePipeline — pass selection
// ---------------------------------------------------------------------------
describe('runOptimizePipeline — pass selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default JD extraction mock
    mockExtractJobData.mockReturnValue(DEFAULT_JD_EXTRACTION);

    // Ensure OPENAI_API_KEY is set so getOpenAIClient() doesn't throw
    process.env.OPENAI_API_KEY = 'test-key';
  });

  // Test 1a: score high enough on pass 1 — should stop at 1 pass
  it('1a: returns pass 1 result when score is already above threshold', async () => {
    const { createMock } = buildOpenAIMock(RESUME_JSON_PASS1);

    // ats_score_optimized=80 (>75), lift=20 (>10) — no pass 2 needed
    mockScoreOptimization.mockResolvedValue(makeAtsScore(60, 80));

    const result = await runOptimizePipeline('resume text', 'job description');

    expect(result.passesUsed).toBe(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  // Test 1b: score below 75 — should run pass 2
  it('1b: runs pass 2 when score is below 75', async () => {
    const createMock = jest.fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS1) } }],
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS2) } }],
      } as any);

    const mockInstance = { chat: { completions: { create: createMock } } };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

    // Pass 1: 40->60 (below 75), Pass 2: 40->70
    mockScoreOptimization
      .mockResolvedValueOnce(makeAtsScore(40, 60))
      .mockResolvedValueOnce(makeAtsScore(40, 70));

    const result = await runOptimizePipeline('resume text', 'job description');

    expect(result.passesUsed).toBe(2);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  // Test 1c: score >= 75 but lift < 10 — should trigger pass 2
  it('1c: runs pass 2 when lift is small (< 10 points) even if score is above 75', async () => {
    const createMock = jest.fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS1) } }],
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS2) } }],
      } as any);

    const mockInstance = { chat: { completions: { create: createMock } } };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

    // 70->76: above 75 but lift=6 < 10
    mockScoreOptimization
      .mockResolvedValueOnce(makeAtsScore(70, 76))
      .mockResolvedValueOnce(makeAtsScore(70, 82));

    const result = await runOptimizePipeline('resume text', 'job description');

    expect(result.passesUsed).toBe(2);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  // Test 1d: pass 2 is worse — should return pass 1 candidate
  it('1d: keeps pass 1 candidate when pass 2 score is lower', async () => {
    const createMock = jest.fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS1) } }],
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS2) } }],
      } as any);

    const mockInstance = { chat: { completions: { create: createMock } } };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

    // Pass 1: 40->60 (triggers pass 2), Pass 2: 40->55 (worse)
    mockScoreOptimization
      .mockResolvedValueOnce(makeAtsScore(40, 60))
      .mockResolvedValueOnce(makeAtsScore(40, 55));

    const result = await runOptimizePipeline('resume text', 'job description');

    // Winner is pass 1
    expect(result.optimizedResume.summary).toBe(RESUME_JSON_PASS1.summary);
  });

  // Test 1e: gap keywords from must_have are passed to the gap prompt in pass 1
  it('1e: gap keywords from must_have are injected into pass 1 user prompt', async () => {
    const capturedMessages: any[][] = [];

    const createMock = jest.fn().mockImplementation(async (params: any) => {
      capturedMessages.push(params.messages);
      return {
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS1) } }],
      };
    });

    const mockInstance = { chat: { completions: { create: createMock } } };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

    // Score high enough so pass 2 is skipped — we only care about call 1
    mockScoreOptimization.mockResolvedValue(makeAtsScore(60, 80));

    // Resume deliberately lacks React, TypeScript, Node.js
    const result = await runOptimizePipeline(
      'I have JavaScript experience',
      'job description'
    );

    expect(result.passesUsed).toBe(1);
    expect(capturedMessages.length).toBe(1);

    // The user message is the messages entry with role 'user'
    const userMessage =
      capturedMessages[0].find((m: any) => m.role === 'user')?.content ?? '';

    expect(userMessage).toContain('React');
    expect(userMessage).toContain('TypeScript');
    expect(userMessage).toContain('Node.js');
  });

  // Test 1f: ATS suggestions are injected into pass 2 prompt
  it('1f: gap keywords from ATS suggestions are injected in pass 2 prompt', async () => {
    const capturedMessages: any[][] = [];

    const createMock = jest.fn().mockImplementation(async (params: any) => {
      capturedMessages.push(params.messages);
      return {
        choices: [{ message: { content: JSON.stringify(RESUME_JSON_PASS1) } }],
      };
    });

    const mockInstance = { chat: { completions: { create: createMock } } };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockInstance as any);

    // Pass 1 score triggers pass 2; suggestions carry AWS and Docker
    const suggestionWithKeywords = {
      category: 'keywords',
      action: {
        type: 'add_keyword',
        params: { keywords: ['AWS', 'Docker'] },
      },
    };

    mockScoreOptimization
      .mockResolvedValueOnce(makeAtsScore(40, 60, [suggestionWithKeywords]))
      .mockResolvedValueOnce(makeAtsScore(40, 70));

    await runOptimizePipeline('resume text with some content', 'job description');

    expect(capturedMessages.length).toBe(2);

    // The second call is pass 2 — check its user message
    const pass2UserMessage =
      capturedMessages[1].find((m: any) => m.role === 'user')?.content ?? '';

    expect(pass2UserMessage).toContain('AWS');
    expect(pass2UserMessage).toContain('Docker');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: normalizeATSScore — honest scoring
// ---------------------------------------------------------------------------
describe('normalizeATSScore — honest scoring', () => {
  // Test 2a: MIN_IMPROVEMENT constant must not exist in the ats module
  it('2a: does not export MIN_IMPROVEMENT (forced boost is gone)', () => {
    expect((atsModule as any).MIN_IMPROVEMENT).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: stripFabricatedMetrics — the fix for the fabrication bug found by
// evals/resume-optimizer (2026-06-26): gpt-4o invents percentages in
// achievement bullets when the source resume has zero metrics, violating its
// own system prompt's "keep impact non-numeric" instruction. This is the
// deterministic guardrail (parallel to RunSmart's enforcePlanSafety) that
// makes the safety guarantee real instead of prompt-only.
// ---------------------------------------------------------------------------
describe('stripFabricatedMetrics', () => {
  const ORIGINAL_NO_METRICS = 'Led a team handling customer tickets. Trained new hires on support tools.';

  it('removes a fabricated percentage not present in the original resume', () => {
    const resume = makeResumeJson();
    resume.experience[0].achievements = ['Led a team, reducing resolution time by 20% through process improvements.'];

    const cleaned = stripFabricatedMetrics(resume, ORIGINAL_NO_METRICS);

    expect(cleaned.experience[0].achievements[0]).not.toMatch(/20%/);
  });

  it('removes multiple fabricated percentages across achievements', () => {
    const resume = makeResumeJson();
    resume.experience[0].achievements = [
      'Reduced resolution time by 20% through efficient process implementation.',
      'Improved CSAT scores by 15% via better training.',
    ];

    const cleaned = stripFabricatedMetrics(resume, ORIGINAL_NO_METRICS);

    const allText = cleaned.experience[0].achievements.join(' ');
    expect(allText).not.toMatch(/20%/);
    expect(allText).not.toMatch(/15%/);
  });

  it('leaves a percentage untouched when it is genuinely present in the original resume', () => {
    const resume = makeResumeJson();
    resume.experience[0].achievements = ['Led a migration, cutting page load time by 35%.'];
    const original = 'Led migration of a legacy app to React, cutting page load time by 35%.';

    const cleaned = stripFabricatedMetrics(resume, original);

    expect(cleaned.experience[0].achievements[0]).toContain('35%');
  });

  it('leaves achievements with no percentages untouched', () => {
    const resume = makeResumeJson();
    resume.experience[0].achievements = ['Built systems used by the team.'];

    const cleaned = stripFabricatedMetrics(resume, ORIGINAL_NO_METRICS);

    expect(cleaned.experience[0].achievements[0]).toBe('Built systems used by the team.');
  });

  it('does not crash on an achievement that is ONLY a fabricated percentage', () => {
    const resume = makeResumeJson();
    resume.experience[0].achievements = ['40%'];

    const cleaned = stripFabricatedMetrics(resume, ORIGINAL_NO_METRICS);

    expect(cleaned.experience[0].achievements[0]).not.toMatch(/40%/);
  });
});
