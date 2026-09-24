import type { OptimizedResume } from '@/lib/ai-optimizer';
import type { ManifestCase } from './manifest';
import type { JudgeVerdict } from './judge';
import { runChecks, criticalFailures } from './checks';
import { runGroundingChecks, type GroundingResult } from './grounding';
import { JudgeInvalidError, type GroundingVerdict } from './judge-grounding';
import { inputHash, type ConfigFingerprint } from './fingerprint';
import { summarizeCalls, type CallRecord, type CallPhase, type RunCallSummary } from './call-ledger';

/**
 * Repeat execution: the same fixed input, run N times, every run accounted for.
 *
 * The question this answers is narrow: given identical input and configuration, does
 * the optimizer reach the same truthfulness verdict, the same recommendations and a
 * similar score each time? Three runs per case is a diagnostic floor, not proof of
 * stability, and 20 synthetic cases support no population-level accuracy figure.
 * The report says so in its own notes.
 */

export interface PlannedRun {
  key: string;
  caseId: string;
  runIndex: number;
  inputHash: string;
}

export type RunStatus =
  | 'completed'
  | 'generation-error'
  | 'judge-invalid'
  | 'judge-error'
  | 'skipped-cost-cap'
  | 'skipped-repeated-failure';

export type Verdict = 'pass' | 'fail' | 'error' | 'skipped';

export interface PipelineOutcome {
  resume: OptimizedResume;
  scores: { original: number; optimized: number; confidence: number };
  recommendationIds: string[];
  passesUsed: number;
  lift: { meaningful: boolean; displayScores: boolean; delta: number };
}

export interface VerdictComponents {
  deterministic: boolean;
  nightlyJudge: boolean | null;
  groundingJudge: boolean | null;
}

export interface RunResult {
  key: string;
  caseId: string;
  runIndex: number;
  inputHash: string;
  configHash: string;
  status: RunStatus;
  verdict: Verdict;
  failureReasons: string[];
  components?: VerdictComponents;
  errorCategory?: string;
  errorMessage?: string;
  latencyMs?: number;
  passesUsed?: number;
  repairCalls?: number;
  scores?: PipelineOutcome['scores'];
  lift?: PipelineOutcome['lift'];
  recommendationIds?: string[];
  criticalFailures?: string[];
  grounding?: GroundingResult;
  nightlyJudge?: JudgeVerdict;
  groundingJudge?: GroundingVerdict;
  calls?: RunCallSummary;
  /** Raw output. Written only to the gitignored output directory. */
  resume?: OptimizedResume;
}

export function planRuns(cases: ManifestCase[], repeats: number): PlannedRun[] {
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error(`repeats must be a positive integer, got ${repeats}`);
  const plan: PlannedRun[] = [];
  // Run-major order: every case once, then every case again. A batch stopped by the
  // cost cap still has at least one run of each case instead of three of a few.
  for (let runIndex = 1; runIndex <= repeats; runIndex++) {
    for (const c of cases) {
      plan.push({ key: `${c.id}#${runIndex}`, caseId: c.id, runIndex, inputHash: inputHash(c, c.evaluationDate) });
    }
  }
  return plan;
}

export function categorizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;
  if (error instanceof JudgeInvalidError) return 'judge-invalid';
  if (/retry cap/i.test(message)) return 'transport-retry-cap';
  if (/cost cap/i.test(message)) return 'cost-cap';
  if (/blocked an outbound request/i.test(message)) return 'side-effect-blocked';
  if (/OPENAI_API_KEY/.test(message)) return 'missing-api-key';
  if (status === 429 || /rate limit/i.test(message)) return 'rate-limit';
  if (/timed? ?out|timeout/i.test(message)) return 'timeout';
  if (error instanceof SyntaxError || /JSON|Invalid .* judge response|judge returned/i.test(message)) return 'invalid-output';
  if (typeof status === 'number' && status >= 500) return 'upstream-5xx';
  return 'other';
}

export interface LedgerView {
  setContext(runKey: string | null, phase: CallPhase | null): void;
  forRun(runKey: string): CallRecord[];
  totalCostUsd(): number;
}

export interface ExecuteDeps {
  cases: ManifestCase[];
  configHash: string;
  generate: (c: ManifestCase) => Promise<PipelineOutcome>;
  nightlyJudge: (c: ManifestCase, resume: OptimizedResume) => Promise<JudgeVerdict>;
  groundingJudge: (c: ManifestCase, resume: OptimizedResume) => Promise<GroundingVerdict>;
  ledger: LedgerView;
  costCapUsd: number;
  /** Worst-case cost of one run before any have been measured. */
  projectedRunCostUsd: number;
  maxIdenticalFailures?: number;
  beforeRun?: (run: PlannedRun) => void;
  onRunComplete?: (result: RunResult) => void;
  now?: () => number;
}

function judgeFailure(error: unknown): { status: RunStatus; reason: string } {
  const invalid = categorizeError(error) === 'judge-invalid' || categorizeError(error) === 'invalid-output';
  const message = error instanceof Error ? error.message : String(error);
  return invalid
    ? { status: 'judge-invalid', reason: `judge-invalid: ${message.slice(0, 160)}` }
    : { status: 'judge-error', reason: `judge-error: ${message.slice(0, 160)}` };
}

async function executeRun(run: PlannedRun, deps: ExecuteDeps): Promise<RunResult> {
  const c = deps.cases.find((x) => x.id === run.caseId);
  if (!c) throw new Error(`planned run ${run.key} names an unknown case`);
  const now = deps.now ?? (() => performance.now());
  const base = { key: run.key, caseId: run.caseId, runIndex: run.runIndex, inputHash: run.inputHash, configHash: deps.configHash };

  deps.ledger.setContext(run.key, 'generation');
  deps.beforeRun?.(run);
  const started = now();
  let outcome: PipelineOutcome;
  try {
    outcome = await deps.generate(c);
  } catch (error) {
    deps.ledger.setContext(null, null);
    return {
      ...base,
      status: 'generation-error',
      verdict: 'error',
      failureReasons: [`generation-error: ${categorizeError(error)}`],
      errorCategory: categorizeError(error),
      errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      latencyMs: now() - started,
      calls: summarizeCalls(deps.ledger.forRun(run.key)),
    };
  }
  const latencyMs = now() - started;

  const critical = criticalFailures(runChecks(outcome.resume, c)).map((f) => `${f.id}: ${f.detail}`);
  const grounding = runGroundingChecks(outcome.resume, c);
  const failureReasons: string[] = [
    ...critical.map((f) => `critical: ${f}`),
    ...grounding.unsupported.map((u) => `grounding:${u.category}: ${u.text}`),
  ];

  deps.ledger.setContext(run.key, 'judge');
  let status: RunStatus = 'completed';
  let nightly: JudgeVerdict | undefined;
  let groundingVerdict: GroundingVerdict | undefined;
  try {
    nightly = await deps.nightlyJudge(c, outcome.resume);
  } catch (error) {
    const f = judgeFailure(error);
    status = f.status;
    failureReasons.push(`nightly-${f.reason}`);
  }
  try {
    groundingVerdict = await deps.groundingJudge(c, outcome.resume);
  } catch (error) {
    const f = judgeFailure(error);
    if (status === 'completed' || f.status === 'judge-invalid') status = f.status;
    failureReasons.push(`grounding-${f.reason}`);
  }
  deps.ledger.setContext(null, null);

  const nightlyPass = nightly ? nightly.overallPass && nightly.truthfulness >= 4 : null;
  if (nightly && !nightlyPass) failureReasons.push(`nightly-judge: ${nightly.reason}`);
  const groundingPass = groundingVerdict
    ? groundingVerdict.honestGapPreserved &&
      groundingVerdict.unsupportedStatements.length === 0 &&
      groundingVerdict.requirements.every((r) => r.ruling !== 'claimed-without-support')
    : null;
  if (groundingVerdict && !groundingPass) {
    for (const r of groundingVerdict.requirements.filter((x) => x.ruling === 'claimed-without-support')) {
      failureReasons.push(`grounding-judge: ${r.id} claimed without support`);
    }
    for (const s of groundingVerdict.unsupportedStatements) failureReasons.push(`grounding-judge:${s.category}: ${s.quote}`);
    if (!groundingVerdict.honestGapPreserved) failureReasons.push('grounding-judge: honest gap papered over');
  }

  const components: VerdictComponents = {
    deterministic: critical.length === 0 && grounding.unsupported.length === 0,
    nightlyJudge: nightlyPass,
    groundingJudge: groundingPass,
  };
  // A judge that could not rule is a failed evaluation, never a pass.
  const verdict: Verdict =
    status === 'completed' && components.deterministic && nightlyPass === true && groundingPass === true ? 'pass' : 'fail';

  const calls = summarizeCalls(deps.ledger.forRun(run.key));
  return {
    ...base,
    status,
    verdict,
    failureReasons,
    components,
    latencyMs,
    passesUsed: outcome.passesUsed,
    repairCalls: Math.max(0, calls.logicalChatCalls - outcome.passesUsed),
    scores: outcome.scores,
    lift: outcome.lift,
    recommendationIds: [...outcome.recommendationIds].sort(),
    criticalFailures: critical,
    grounding,
    nightlyJudge: nightly,
    groundingJudge: groundingVerdict,
    calls,
    resume: outcome.resume,
  };
}

function skipped(run: PlannedRun, configHash: string, status: RunStatus, reason: string): RunResult {
  return {
    key: run.key,
    caseId: run.caseId,
    runIndex: run.runIndex,
    inputHash: run.inputHash,
    configHash,
    status,
    verdict: 'skipped',
    failureReasons: [reason],
  };
}

function failureSignature(r: RunResult): string | null {
  if (r.status === 'completed') return null;
  return `${r.status}:${r.errorCategory ?? ''}:${(r.errorMessage ?? r.failureReasons.join('|')).slice(0, 120)}`;
}

export async function executePlan(plan: PlannedRun[], deps: ExecuteDeps): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const maxIdentical = deps.maxIdenticalFailures ?? 3;
  const runCosts: number[] = [];
  let stop: { status: RunStatus; reason: string } | null = null;
  const streak: string[] = [];

  for (const run of plan) {
    if (stop) {
      results.push(skipped(run, deps.configHash, stop.status, stop.reason));
      continue;
    }
    const spent = deps.ledger.totalCostUsd();
    const projected = Math.max(deps.projectedRunCostUsd, ...runCosts);
    if (spent + projected > deps.costCapUsd) {
      stop = {
        status: 'skipped-cost-cap',
        reason: `cost cap: spent $${spent.toFixed(4)} + projected $${projected.toFixed(4)} > cap $${deps.costCapUsd.toFixed(2)}`,
      };
      results.push(skipped(run, deps.configHash, stop.status, stop.reason));
      continue;
    }

    const before = deps.ledger.totalCostUsd();
    const result = await executeRun(run, deps);
    runCosts.push(deps.ledger.totalCostUsd() - before);
    results.push(result);
    deps.onRunComplete?.(result);

    const sig = failureSignature(result);
    if (sig) streak.push(sig);
    else streak.length = 0;
    if (streak.length >= maxIdentical && streak.slice(-maxIdentical).every((s) => s === sig)) {
      stop = { status: 'skipped-repeated-failure', reason: `stopped after ${maxIdentical} identical failures: ${sig}` };
    }
  }
  return results;
}

// ------------------------------------------------------------------ accounting

export interface Accounting {
  planned: number;
  recorded: number;
  byStatus: Record<RunStatus, number>;
  missing: string[];
  unexpected: string[];
  duplicates: string[];
  complete: boolean;
}

export function accountRuns(plan: PlannedRun[], results: RunResult[]): Accounting {
  const plannedKeys = new Set(plan.map((p) => p.key));
  const seen = new Map<string, number>();
  for (const r of results) seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
  const byStatus: Record<RunStatus, number> = {
    completed: 0,
    'generation-error': 0,
    'judge-invalid': 0,
    'judge-error': 0,
    'skipped-cost-cap': 0,
    'skipped-repeated-failure': 0,
  };
  for (const r of results) byStatus[r.status]++;
  const missing = [...plannedKeys].filter((k) => !seen.has(k));
  const unexpected = [...seen.keys()].filter((k) => !plannedKeys.has(k));
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  return {
    planned: plan.length,
    recorded: results.length,
    byStatus,
    missing,
    unexpected,
    duplicates,
    complete: missing.length === 0 && unexpected.length === 0 && duplicates.length === 0 && results.length === plan.length,
  };
}

// ------------------------------------------------------------------ report

function range(values: number[]) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min, values };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function flips<T>(values: Array<T | null | undefined>): boolean {
  const defined = values.filter((v) => v !== null && v !== undefined);
  return new Set(defined.map((v) => JSON.stringify(v))).size > 1;
}

export interface CaseStability {
  caseId: string;
  fitLabel: ManifestCase['fitLabel'];
  language: ManifestCase['language'];
  runs: number;
  inputHash: string | null;
  identicalInputHash: boolean;
  identicalConfigHash: boolean;
  statuses: RunStatus[];
  verdicts: Verdict[];
  /** Runs disagree on pass / fail / error. Skipped runs do not count toward a flip. */
  verdictFlipped: boolean;
  componentFlips: { deterministic: boolean; nightlyJudge: boolean; groundingJudge: boolean; displayScores: boolean; meaningfulLift: boolean };
  requirementRulingFlips: string[];
  optimizedScore: ReturnType<typeof range>;
  originalScore: ReturnType<typeof range>;
  recommendations: { stable: string[]; changed: string[] };
  evidenceCoverage: number[];
  factsLost: Array<{ fact: string; runs: number }>;
  unsupported: { deterministicPerRun: number[]; judgePerRun: number[]; examples: string[] };
  costUsd: number;
  latencyMs: { median: number | null; max: number | null };
}

export interface RegressionFinding {
  caseId: string;
  kind: 'pass-rate-dropped' | 'median-score-dropped' | 'more-unsupported' | 'not-comparable';
  detail: string;
}

export interface StabilityReport {
  manifestVersion: string;
  evaluationDate: string;
  repeats: number;
  config: ConfigFingerprint | null;
  accounting: Accounting;
  verdictFlipCount: number;
  casesWithVerdictFlips: string[];
  totals: {
    costUsd: number;
    wallTimeMs: number | null;
    modelCalls: number;
    transportRetries: number;
    repairCalls: number;
    judgeInvalid: number;
    blockedSideEffects: number;
    requestedModels: string[];
    returnedModels: string[];
    sampleLatencyMs: { median: number | null; p95: number | null; n: number };
  };
  cases: CaseStability[];
  regressions: RegressionFinding[];
  notes: string[];
}

export interface ReportMeta {
  manifestVersion: string;
  evaluationDate: string;
  repeats: number;
  config: ConfigFingerprint | null;
  wallTimeMs: number | null;
  ledgerRecords: CallRecord[];
  blockedSideEffects: number;
}

export function buildStabilityReport(
  cases: ManifestCase[],
  plan: PlannedRun[],
  results: RunResult[],
  meta: ReportMeta,
  baseline?: StabilityReport
): StabilityReport {
  const accounting = accountRuns(plan, results);

  const perCase: CaseStability[] = cases.map((c) => {
    const rs = results.filter((r) => r.caseId === c.id).sort((a, b) => a.runIndex - b.runIndex);
    const ran = rs.filter((r) => r.verdict !== 'skipped');
    const done = rs.filter((r) => r.scores);

    const recSets = done.map((r) => new Set(r.recommendationIds ?? []));
    const union = new Set(recSets.flatMap((s) => [...s]));
    const stable = [...union].filter((id) => recSets.every((s) => s.has(id))).sort();
    const changed = [...union].filter((id) => !stable.includes(id)).sort();

    const rulingFlips = c.requirements
      .map((req) => req.id)
      .filter((id) => flips(rs.map((r) => r.groundingJudge?.requirements.find((x) => x.id === id)?.ruling)));

    const lostCounts = new Map<string, number>();
    for (const r of done) {
      for (const f of r.grounding?.retention.lost ?? []) {
        const k = `${f.kind}:${f.value}`;
        lostCounts.set(k, (lostCounts.get(k) ?? 0) + 1);
      }
    }

    const latencies = ran.map((r) => r.latencyMs).filter((x): x is number => typeof x === 'number');
    const examples = [
      ...new Set(
        done.flatMap((r) => [
          ...(r.grounding?.unsupported.map((u) => `${u.category}: ${u.text}`) ?? []),
          ...(r.groundingJudge?.unsupportedStatements.map((u) => `judge ${u.category}: ${u.quote}`) ?? []),
        ])
      ),
    ].slice(0, 8);

    return {
      caseId: c.id,
      fitLabel: c.fitLabel,
      language: c.language,
      runs: rs.length,
      inputHash: rs[0]?.inputHash ?? null,
      identicalInputHash: new Set(rs.map((r) => r.inputHash)).size <= 1,
      identicalConfigHash: new Set(rs.map((r) => r.configHash)).size <= 1,
      statuses: rs.map((r) => r.status),
      verdicts: rs.map((r) => r.verdict),
      verdictFlipped: flips(ran.map((r) => r.verdict)),
      componentFlips: {
        deterministic: flips(done.map((r) => r.components?.deterministic)),
        nightlyJudge: flips(done.map((r) => r.components?.nightlyJudge)),
        groundingJudge: flips(done.map((r) => r.components?.groundingJudge)),
        displayScores: flips(done.map((r) => r.lift?.displayScores)),
        meaningfulLift: flips(done.map((r) => r.lift?.meaningful)),
      },
      requirementRulingFlips: rulingFlips,
      optimizedScore: range(done.map((r) => r.scores!.optimized)),
      originalScore: range(done.map((r) => r.scores!.original)),
      recommendations: { stable, changed },
      evidenceCoverage: done.map((r) =>
        r.grounding && r.grounding.evidence.anchored > 0 ? r.grounding.evidence.retained / r.grounding.evidence.anchored : 1
      ),
      factsLost: [...lostCounts.entries()].map(([fact, runs]) => ({ fact, runs })),
      unsupported: {
        deterministicPerRun: done.map((r) => r.grounding?.unsupported.length ?? 0),
        judgePerRun: done.map((r) => r.groundingJudge?.unsupportedStatements.length ?? 0),
        examples,
      },
      costUsd: rs.reduce((n, r) => n + (r.calls?.costUsd ?? 0), 0),
      latencyMs: { median: median(latencies), max: latencies.length ? Math.max(...latencies) : null },
    };
  });

  const allLatencies = results.map((r) => r.latencyMs).filter((x): x is number => typeof x === 'number');
  const sorted = [...allLatencies].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null;
  const ledger = summarizeCalls(meta.ledgerRecords);

  const report: StabilityReport = {
    manifestVersion: meta.manifestVersion,
    evaluationDate: meta.evaluationDate,
    repeats: meta.repeats,
    config: meta.config,
    accounting,
    verdictFlipCount: perCase.filter((c) => c.verdictFlipped).length,
    casesWithVerdictFlips: perCase.filter((c) => c.verdictFlipped).map((c) => c.caseId),
    totals: {
      costUsd: ledger.costUsd,
      wallTimeMs: meta.wallTimeMs,
      modelCalls: ledger.modelCalls,
      transportRetries: ledger.transportRetries,
      repairCalls: results.reduce((n, r) => n + (r.repairCalls ?? 0), 0),
      judgeInvalid: results.filter((r) => r.status === 'judge-invalid').length,
      blockedSideEffects: meta.blockedSideEffects,
      requestedModels: ledger.requestedModels,
      returnedModels: ledger.returnedModels,
      sampleLatencyMs: { median: median(allLatencies), p95, n: allLatencies.length },
    },
    cases: perCase,
    regressions: baseline ? compareToBaseline(perCase, baseline) : [],
    notes: [
      `${meta.repeats} runs per case is a diagnostic minimum, not proof of stability.`,
      'No population-level accuracy is reported: 20 synthetic cases cannot support one.',
      'Latency figures are a small sample from one machine, not a production p95.',
      'Labels describe what the documents support, not whether anyone should be hired.',
    ],
  };
  return report;
}

export function compareToBaseline(current: CaseStability[], baseline: StabilityReport): RegressionFinding[] {
  const findings: RegressionFinding[] = [];
  const passRate = (c: CaseStability) => {
    const judged = c.verdicts.filter((v) => v !== 'skipped');
    return judged.length ? judged.filter((v) => v === 'pass').length / judged.length : null;
  };
  for (const c of current) {
    const b = baseline.cases.find((x) => x.caseId === c.caseId);
    if (!b) continue;
    if (b.inputHash !== c.inputHash) {
      findings.push({ caseId: c.caseId, kind: 'not-comparable', detail: 'input changed since the baseline' });
      continue;
    }
    const pNow = passRate(c);
    const pBefore = passRate(b);
    if (pNow !== null && pBefore !== null && pNow < pBefore) {
      findings.push({ caseId: c.caseId, kind: 'pass-rate-dropped', detail: `${pBefore.toFixed(2)} -> ${pNow.toFixed(2)}` });
    }
    const mNow = median(c.optimizedScore?.values ?? []);
    const mBefore = median(b.optimizedScore?.values ?? []);
    if (mNow !== null && mBefore !== null && mBefore - mNow >= 5) {
      findings.push({ caseId: c.caseId, kind: 'median-score-dropped', detail: `${mBefore} -> ${mNow}` });
    }
    const uNow = median(c.unsupported.deterministicPerRun.map((d, i) => d + (c.unsupported.judgePerRun[i] ?? 0)));
    const uBefore = median(b.unsupported.deterministicPerRun.map((d, i) => d + (b.unsupported.judgePerRun[i] ?? 0)));
    if (uNow !== null && uBefore !== null && uNow > uBefore) {
      findings.push({ caseId: c.caseId, kind: 'more-unsupported', detail: `median ${uBefore} -> ${uNow}` });
    }
  }
  return findings;
}
