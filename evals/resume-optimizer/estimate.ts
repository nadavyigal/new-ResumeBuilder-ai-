import {
  RESUME_OPTIMIZATION_SYSTEM_PROMPT,
  RESUME_OPTIMIZATION_GAP_PROMPT,
  OPTIMIZATION_CONFIG,
} from '@/lib/prompts/resume-optimizer';
import type { ManifestCase } from './manifest';
import { PRICES_PER_MTOK, PRICES_CHECKED_ON } from './call-ledger';
import { GROUNDING_JUDGE_MODEL, buildGroundingPrompt } from './judge-grounding';

/**
 * Offline cost estimate for a repeat batch, built from the real prompts.
 *
 * Token counts are a character heuristic, not a tokenizer: Latin text at 3.5
 * characters per token and Hebrew at 1.5, both on the expensive side. The first paid
 * batch records real usage per call; replace this estimate with those numbers before
 * trusting it for a second batch.
 *
 * Call counts per run follow the pipeline's own policy (optimize-pipeline.ts):
 * - typical: pass 1 and pass 2, both of which run on most inputs;
 * - worst: pass 1 fails, the plain-optimizer fallback runs, the WP-64 zero-bullet
 *   retry runs, then pass 2, and every one of those four is billed twice because a
 *   client-side timeout can still be charged and the ledger allows one retry.
 * Each run also makes two judge calls and a handful of embedding calls.
 */

const HEBREW = /[֐-׿]/g;

export function estimateTokens(text: string): number {
  const hebrew = (text.match(HEBREW) ?? []).length;
  const other = text.length - hebrew;
  return Math.ceil(other / 3.5 + hebrew / 1.5);
}

function price(model: string) {
  const p = PRICES_PER_MTOK[model];
  if (!p) throw new Error(`no price recorded for ${model}`);
  return p;
}

function callCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = price(model);
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

const TYPICAL_OUTPUT_TOKENS = 1200;
const NIGHTLY_JUDGE_PROMPT_TOKENS = 700;
const JUDGE_OUTPUT_TOKENS = 350;
const GAP_LIST_ALLOWANCE_TOKENS = 250;

export interface CaseEstimate {
  caseId: string;
  typicalRunUsd: number;
  worstRunUsd: number;
}

export interface BatchEstimate {
  pricesCheckedOn: string;
  generationModel: string;
  repeats: number;
  runs: number;
  perCase: CaseEstimate[];
  typicalUsd: number;
  worstUsd: number;
  maxWorstRunUsd: number;
  calibrationUsd: number;
  /**
   * The cap to ask for: three times the typical batch (never above the theoretical
   * worst) plus calibration, rounded up. The theoretical worst assumes every run
   * takes every failure path; the runner stops after three identical failures and
   * the ledger refuses calls past the cap, so that path cannot run 60 times.
   */
  recommendedCapUsd: number;
}

export function estimateCase(c: ManifestCase): CaseEstimate {
  const model = OPTIMIZATION_CONFIG.model;
  const system = estimateTokens(RESUME_OPTIMIZATION_SYSTEM_PROMPT) + 80;
  const pass1Input =
    system +
    estimateTokens(RESUME_OPTIMIZATION_GAP_PROMPT(c.resumeText, c.jobDescription, { missingKeywords: [], lowSubscores: {}, mustHave: [] })) +
    GAP_LIST_ALLOWANCE_TOKENS;
  const resumeOut = Math.ceil(estimateTokens(c.resumeText) * 1.4) + 300;
  const pass2Input = system + resumeOut + estimateTokens(c.jobDescription) + GAP_LIST_ALLOWANCE_TOKENS + 200;

  const typicalGen = callCost(model, pass1Input, TYPICAL_OUTPUT_TOKENS) + callCost(model, pass2Input, TYPICAL_OUTPUT_TOKENS);
  const worstGen =
    2 *
    (3 * callCost(model, pass1Input, OPTIMIZATION_CONFIG.maxTokens) + callCost(model, pass2Input, OPTIMIZATION_CONFIG.maxTokens));

  const source = estimateTokens(c.resumeText) + estimateTokens(c.jobDescription);
  const judgeInput = NIGHTLY_JUDGE_PROMPT_TOKENS + source + resumeOut;
  const fakeOutput = { summary: c.resumeText } as never;
  const groundingInput = estimateTokens(buildGroundingPrompt(c, fakeOutput)) + resumeOut;
  const judges =
    callCost('gpt-4o-mini', judgeInput, JUDGE_OUTPUT_TOKENS) + callCost(GROUNDING_JUDGE_MODEL, groundingInput, JUDGE_OUTPUT_TOKENS);

  // Two scorings per run, each embedding the job text and the résumé sections on both sides.
  const embeddings = callCost('text-embedding-3-small', 2 * (estimateTokens(c.jobDescription) + 2 * resumeOut), 0);

  return {
    caseId: c.id,
    typicalRunUsd: typicalGen + judges + embeddings,
    worstRunUsd: worstGen + 2 * judges + 2 * embeddings,
  };
}

export function estimateBatch(cases: ManifestCase[], repeats: number, calibrationItems = 10): BatchEstimate {
  const perCase = cases.map(estimateCase);
  const typicalUsd = repeats * perCase.reduce((n, c) => n + c.typicalRunUsd, 0);
  const worstUsd = repeats * perCase.reduce((n, c) => n + c.worstRunUsd, 0);
  const calibrationUsd = calibrationItems * 2 * callCost('gpt-4o-mini', 2500, JUDGE_OUTPUT_TOKENS);
  return {
    pricesCheckedOn: PRICES_CHECKED_ON,
    generationModel: OPTIMIZATION_CONFIG.model,
    repeats,
    runs: repeats * cases.length,
    perCase,
    typicalUsd,
    worstUsd,
    maxWorstRunUsd: Math.max(...perCase.map((c) => c.worstRunUsd)),
    calibrationUsd,
    recommendedCapUsd: Math.ceil(Math.min(worstUsd, 3 * typicalUsd) + calibrationUsd),
  };
}
