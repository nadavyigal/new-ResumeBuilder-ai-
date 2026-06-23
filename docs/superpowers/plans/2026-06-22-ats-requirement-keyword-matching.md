# ATS Requirement Keyword Matching — Complete Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the ATS from under-scoring qualified candidates by atomizing job requirements into keywords once — feeding both the optimizer (so it truthfully injects the JD's vocabulary) and the scorer (so `keyword_exact` credits real overlap) — and crediting partial token coverage.

**Architecture:** A new domain-agnostic skill-phrase extractor turns sentence-style requirements into short keywords. `buildJobDataFromExtractedJson` (the single function both the scorer and the optimizer read `must_have` from) calls it, so one change fixes both paths. The requirement matcher additionally scores by proportional token coverage instead of an all-or-nothing 60% gate.

**Tech Stack:** TypeScript, Jest (`jest-environment-jsdom`), `@/` path alias → `src/`. No new dependencies.

---

## Background — Two Compounding Defects, One Root Cause (verified)

LinkedIn JDs with a structured requirements list store each requirement as a **full sentence**, and `buildJobDataFromExtractedJson` ([src/lib/ats/job-data-resolver.ts:173](../../src/lib/ats/job-data-resolver.ts)) feeds those sentences straight into `must_have`. That breaks two things:

1. **Scorer:** `KeywordExactAnalyzer` (22% weight) counts a requirement matched only if `skillMatchesResume` finds ≥60% of the whole sentence's tokens ([src/lib/ats/skill-match.ts:63](../../src/lib/ats/skill-match.ts)). Long sentences are unmatchable → measured **9% (1/11)** for a qualified BD candidate vs the real Cal JD.
2. **Optimizer:** `buildInitialGaps` ([src/lib/ai-optimizer/optimize-pipeline.ts:77](../../src/lib/ai-optimizer/optimize-pipeline.ts)) marks every sentence as a "missing keyword" and the gap prompt asks the LLM to inject whole sentences — vague guidance, so the resume never gains crisp terms ("market research", "negotiations", "financial services"). `keyword_exact` stays under the `keyword_cap_threshold: 40` ([src/lib/ats/config/thresholds.ts](../../src/lib/ats/config/thresholds.ts)), which keeps `semantic_relevance` (16%) capped at 70. That ceiling is the observed real-world score of 36% after optimization.

**Prototype proof of the complete fix** (real Cal JD + real BD resume):
- Atomic keywords vs original resume: **28%** (fair credit for real overlap).
- Atomic keywords vs a *truthfully* optimized resume: **63%** — crosses 40, uncaps semantic, lifts the overall into a defensible ~55–65% band.
- The same atomic keywords vs the finance candidate's resume against a cloud/DevOps role (ScaleOps) stay **low** — the fix does not inflate genuine mismatches.

**Both the scorer and the optimizer read `must_have` from `buildJobDataFromExtractedJson`** (scorer via `prepareInput` in [src/lib/ats/index.ts:208](../../src/lib/ats/index.ts); optimizer via [optimize-pipeline.ts:133](../../src/lib/ai-optimizer/optimize-pipeline.ts)). Atomizing there fixes both with no change to the optimizer prompt.

**Why a new extractor (not `extractKeywords`):** `extractKeywords` ([src/lib/ats/utils/text-utils.ts:133](../../src/lib/ats/utils/text-utils.ts)) is hard-coded to programming languages/frameworks and under-extracts for BD/finance/marketing roles. The new extractor is domain-agnostic (verb/stopword stripping + noun-phrase chunks), no keyword allow-list.

---

## File Structure

- **Create** `src/lib/ats/extractors/skill-phrase-extractor.ts` — `extractSkillPhrases(requirements: string[]): string[]`, domain-agnostic atomizer.
- **Modify** `src/lib/ats/job-data-resolver.ts` — `buildJobDataFromExtractedJson` atomizes `must_have` and `nice_to_have` through the extractor; leaves `requirements`/`responsibilities` (JD context for the LLM) untouched.
- **Modify** `src/lib/ats/skill-match.ts` — add `skillCoverage` / `scoreSkillCoverage` (proportional), keep existing exports as wrappers.
- **Modify** `src/lib/ats/analyzers/keyword-exact.ts` — earn points by summed coverage.
- **Modify** `src/lib/ats/config/thresholds.ts` — add `match_classification_threshold`.
- **Test (create)** `tests/unit/ats-skill-phrase-extractor.test.ts`
- **Test (create)** `tests/unit/ats-keyword-exact-coverage.test.ts`
- **Test (extend)** `tests/unit/ats-skill-match.test.ts`

---

## Task 1: Domain-agnostic skill-phrase extractor

**Files:**
- Create: `src/lib/ats/extractors/skill-phrase-extractor.ts`
- Test: `tests/unit/ats-skill-phrase-extractor.test.ts`

- [ ] **Step 1: Write the failing test (real Cal requirements)**

Create `tests/unit/ats-skill-phrase-extractor.test.ts`:

```ts
import { extractSkillPhrases } from '@/lib/ats/extractors/skill-phrase-extractor';

const CAL_REQUIREMENTS = [
  'Develop, build, and lead strategic partnerships while identifying opportunities for market expansion and entry into new markets',
  'Conduct market research and analyze industry trends, competitive landscapes, and customer behavior',
  'Lead the identification, evaluation, and analysis of new business opportunities within the financial services sector',
  'Manage negotiations and close commercial agreements with strategic partners and potential key clients',
  'Lead cross-functional initiatives and support the execution of the growth strategy',
  '2-3 years of experience in Business Development, Strategy Consulting, or as a Commercial Lawyer',
  'Experience working with senior executives and key stakeholders',
  'Experience in the financial services industry and/or payments ecosystem',
];

describe('extractSkillPhrases', () => {
  const phrases = extractSkillPhrases(CAL_REQUIREMENTS);
  const lc = phrases.map((p) => p.toLowerCase());
  const has = (needle: string) => lc.some((p) => p.includes(needle));

  it('produces short keyword phrases, not whole sentences', () => {
    expect(phrases.length).toBeGreaterThan(8);
    expect(phrases.every((p) => p.split(' ').length <= 3)).toBe(true);
  });

  it('extracts the truthfully-addable BD/finance keywords', () => {
    expect(has('market research')).toBe(true);
    expect(has('strategic partnerships')).toBe(true);
    expect(has('financial services')).toBe(true);
    expect(has('negotiation')).toBe(true);
    expect(has('business development')).toBe(true);
    expect(has('stakeholders')).toBe(true);
  });

  it('drops leading action verbs and bare connectors', () => {
    expect(lc).not.toContain('develop');
    expect(lc).not.toContain('lead');
    expect(lc).not.toContain('and');
    expect(lc).not.toContain('the');
    expect(lc).not.toContain('');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest tests/unit/ats-skill-phrase-extractor.test.ts 2>&1 | tail -20`
Expected: FAIL — `extractSkillPhrases is not a function`.

- [ ] **Step 3: Implement the extractor**

Create `src/lib/ats/extractors/skill-phrase-extractor.ts`:

```ts
import { normalizeText, tokenize } from '../utils/text-utils';
import { KEYWORD_THRESHOLDS } from '../config/thresholds';

// Verbs/qualifiers that open a requirement clause but are not themselves skills.
const LEADING_NOISE = new Set([
  'develop', 'build', 'lead', 'manage', 'conduct', 'maintain', 'identify',
  'support', 'drive', 'create', 'design', 'execute', 'deliver', 'own', 'scale',
  'generate', 'craft', 'communicate', 'represent', 'strengthen', 'analyze',
  'evaluate', 'close', 'ensure', 'help', 'provide', 'perform', 'handle',
  'oversee', 'coordinate', 'proven', 'strong', 'excellent', 'demonstrated',
  'experienced', 'deep', 'solid', 'ability', 'track', 'record', 'knowledge',
  'understanding', 'experience', 'years', 'including', 'various', 'related',
  'relevant', 'existing', 'potential', 'complex', 'work', 'working',
]);

// Pure connectors / fillers that must never stand alone as a phrase.
const CONNECTORS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'while',
  'as', 'within', 'across', 'into', 'your', 'our', 'their', 'that', 'this',
  'on', 'by', 'at', 'from', 'is', 'are', 'be', 'will', 'you', 'we', 'they',
  'them', 'its', 'plus', 'etc', 'via', 'per', 'end', 'able', 'other', 'both',
  'all', 'any', 'using', 'use', 'well', 'more', 'most', 'than', 'then', 'new',
]);

// Split requirements into clauses on punctuation and coordinating words.
const CLAUSE_SPLIT =
  /[,;:.()\/]|\b(?:and|or|while|including|such as|with|to|but|as|within|across|through|for)\b/gi;

/**
 * Turn sentence-style job requirements into short (1–3 word) keyword phrases,
 * domain-agnostically. Strips leading action verbs/qualifiers and bare
 * connectors so the matcher and the optimizer see "market research",
 * "strategic partnerships", "financial services" instead of full sentences.
 */
export function extractSkillPhrases(requirements: string[]): string[] {
  const phrases = new Set<string>();

  for (const raw of requirements) {
    if (!raw) continue;
    for (const clause of normalizeText(raw).split(CLAUSE_SPLIT)) {
      const tokens = tokenize(clause).filter(Boolean);

      // Drop leading verbs/qualifiers/connectors and too-short tokens.
      let start = 0;
      while (
        start < tokens.length &&
        (LEADING_NOISE.has(tokens[start]) ||
          CONNECTORS.has(tokens[start]) ||
          tokens[start].length < KEYWORD_THRESHOLDS.min_keyword_length)
      ) {
        start += 1;
      }

      const kept = tokens
        .slice(start)
        .filter(
          (t) => !CONNECTORS.has(t) && t.length >= KEYWORD_THRESHOLDS.min_keyword_length,
        );

      if (kept.length === 0) continue;
      phrases.add(kept.slice(0, 3).join(' '));
    }
  }

  return Array.from(phrases);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest tests/unit/ats-skill-phrase-extractor.test.ts 2>&1 | tail -20`
Expected: PASS. If `has('negotiation')` fails because the clause yielded "negotiations" only, that still contains "negotiation" as a substring — assertion uses `includes`, so it passes. If any keyword genuinely missing, widen the clause split rather than hard-coding terms.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ats/extractors/skill-phrase-extractor.ts tests/unit/ats-skill-phrase-extractor.test.ts
git commit -m "feat(ats): add domain-agnostic requirement-to-keyword extractor"
```

---

## Task 2: Proportional coverage in skill-match

**Files:**
- Modify: `src/lib/ats/skill-match.ts`
- Modify: `src/lib/ats/config/thresholds.ts`
- Test: `tests/unit/ats-skill-match.test.ts`

- [ ] **Step 1: Add the classification threshold**

In `src/lib/ats/config/thresholds.ts`, inside `KEYWORD_THRESHOLDS`, add after `min_keyword_length: 3,`:

```ts
  /** Fraction of a requirement's significant tokens that must appear in the
   *  resume to still label it "matched" (for evidence + gap detection).
   *  Scoring is proportional; this only affects matched/missing labelling. */
  match_classification_threshold: 0.6,
```

- [ ] **Step 2: Write the failing test**

Append to `tests/unit/ats-skill-match.test.ts`:

```ts
import { skillCoverage, scoreSkillCoverage } from '@/lib/ats/skill-match';

describe('skill coverage (proportional)', () => {
  const resume = `
    OPYO, Business Development Manager, Partnerships.
    Develop and nurture strategic partnerships across the financial ecosystem.
  `;

  it('returns 1 when every significant token is present', () => {
    expect(skillCoverage('strategic partnerships', resume)).toBe(1);
  });

  it('returns a partial fraction, not 0, for partly-covered phrases', () => {
    const c = skillCoverage('strategic partnerships financial ecosystem', resume);
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('returns 0 when no significant token is present', () => {
    expect(skillCoverage('kubernetes autoscaling', resume)).toBe(0);
  });

  it('scores a list by average coverage and labels matched/missing', () => {
    const r = scoreSkillCoverage(['strategic partnerships', 'kubernetes autoscaling'], resume);
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThan(60);
    expect(r.matched).toEqual(['strategic partnerships']);
    expect(r.missing).toEqual(['kubernetes autoscaling']);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx jest tests/unit/ats-skill-match.test.ts -t "proportional" 2>&1 | tail -20`
Expected: FAIL — `skillCoverage is not a function`.

- [ ] **Step 4: Implement coverage**

Add to `src/lib/ats/skill-match.ts` (reuse the existing `containsWholePhrase`, `significantTokens`, `normalizeText`; `KEYWORD_THRESHOLDS` is already imported):

```ts
/** Fraction (0–1) of a skill phrase's significant tokens present in the resume. */
export function skillCoverage(skill: string, resumeText: string): number {
  const normalizedSkill = normalizeText(skill);
  const normalizedResume = normalizeText(resumeText);
  if (!normalizedSkill || !normalizedResume) return 0;

  if (
    normalizedSkill.length >= KEYWORD_THRESHOLDS.min_keyword_length &&
    containsWholePhrase(normalizedResume, normalizedSkill)
  ) {
    return 1;
  }

  const tokens = significantTokens(skill);
  if (tokens.length === 0) return 0;

  const matched = tokens.filter((t) => containsWholePhrase(normalizedResume, t)).length;
  return matched / tokens.length;
}

/** Score a skill list by average token coverage; matched/missing keep a threshold. */
export function scoreSkillCoverage(skills: string[], resumeText: string): {
  matched: string[];
  missing: string[];
  score: number;
} {
  const uniqueSkills = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];
  if (uniqueSkills.length === 0) {
    return { matched: [], missing: [], score: 50 };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  let coverageSum = 0;

  for (const skill of uniqueSkills) {
    const coverage = skillCoverage(skill, resumeText);
    coverageSum += coverage;
    if (coverage >= KEYWORD_THRESHOLDS.match_classification_threshold) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return { matched, missing, score: (coverageSum / uniqueSkills.length) * 100 };
}
```

- [ ] **Step 5: Run to confirm pass (no regressions)**

Run: `npx jest tests/unit/ats-skill-match.test.ts 2>&1 | tail -20`
Expected: PASS, existing `skill-match` + `resolveAtsDisplay` describes still green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ats/skill-match.ts src/lib/ats/config/thresholds.ts tests/unit/ats-skill-match.test.ts
git commit -m "feat(ats): proportional token coverage for requirement matching"
```

---

## Task 3: Atomize must_have at the shared chokepoint

**Files:**
- Modify: `src/lib/ats/job-data-resolver.ts`
- Test: `tests/unit/ats-skill-match.test.ts` (add a resolver describe) or extend existing resolver coverage

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/ats-skill-match.test.ts`:

```ts
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';

describe('buildJobDataFromExtractedJson atomizes must_have', () => {
  it('turns sentence requirements into short keyword phrases', () => {
    const jd = buildJobDataFromExtractedJson({
      job_title: 'Business Development Manager',
      company_name: 'Cal',
      requirements: [
        'Conduct market research and analyze industry trends',
        'Manage negotiations and close commercial agreements with strategic partners',
        'Experience in the financial services industry and payments ecosystem',
      ],
    });

    expect(jd.must_have.every((k) => k.split(' ').length <= 3)).toBe(true);
    const lc = jd.must_have.map((k) => k.toLowerCase());
    expect(lc.some((k) => k.includes('market research'))).toBe(true);
    expect(lc.some((k) => k.includes('financial services'))).toBe(true);
    expect(lc).not.toContain(
      'conduct market research and analyze industry trends',
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest tests/unit/ats-skill-match.test.ts -t "atomizes must_have" 2>&1 | tail -20`
Expected: FAIL — `must_have` still contains the full sentence.

- [ ] **Step 3: Wire the extractor into the resolver**

In `src/lib/ats/job-data-resolver.ts`, add the import near the top:

```ts
import { extractSkillPhrases } from './extractors/skill-phrase-extractor';
```

In `buildJobDataFromExtractedJson`, after the existing block that computes `must_have` and `nice_to_have` (around line 180, after the `if (must_have.length === 0 && fallbackText) { ... }` fallback), atomize before returning:

```ts
  // Atomize sentence-style requirements into short keyword phrases so the
  // scorer (keyword_exact) and the optimizer (gap injection) both work on
  // matchable keywords instead of whole sentences. Falls back to the original
  // list if atomization yields nothing.
  const atomizedMustHave = extractSkillPhrases(must_have);
  if (atomizedMustHave.length > 0) {
    must_have = atomizedMustHave;
  }
  const atomizedNiceToHave = extractSkillPhrases(nice_to_have);
  if (atomizedNiceToHave.length > 0) {
    nice_to_have = atomizedNiceToHave;
  }
```

`must_have` and `nice_to_have` are declared with `let` at the top of the function — confirm and change `const` to `let` if needed. Do NOT touch `responsibilities` or `requirements` in the returned object; those stay as full sentences so the JD text the LLM reads keeps its context.

- [ ] **Step 4: Run to confirm pass**

Run: `npx jest tests/unit/ats-skill-match.test.ts -t "atomizes must_have" 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ats/job-data-resolver.ts tests/unit/ats-skill-match.test.ts
git commit -m "feat(ats): atomize must_have keywords feeding scorer and optimizer"
```

---

## Task 4: Keyword-exact analyzer scores on coverage + end-to-end regression

**Files:**
- Modify: `src/lib/ats/analyzers/keyword-exact.ts`
- Test: `tests/unit/ats-keyword-exact-coverage.test.ts` (create)

- [ ] **Step 1: Write the failing regression test (real fixtures, full chain)**

Create `tests/unit/ats-keyword-exact-coverage.test.ts`:

```ts
import { KeywordExactAnalyzer } from '@/lib/ats/analyzers/keyword-exact';
import { buildJobDataFromExtractedJson } from '@/lib/ats/job-data-resolver';
import type { AnalyzerInput } from '@/lib/ats/types';

const CAL = buildJobDataFromExtractedJson({
  job_title: 'Business Development Manager',
  company_name: 'Cal',
  requirements: [
    'Develop, build, and lead strategic partnerships while identifying opportunities for market expansion',
    'Conduct market research and analyze industry trends, competitive landscapes, and customer behavior',
    'Lead the identification and analysis of new business opportunities within the financial services sector',
    'Manage negotiations and close commercial agreements with strategic partners',
    'Lead cross-functional initiatives and support the execution of the growth strategy',
    '2-3 years of experience in Business Development or Strategy Consulting',
    'Experience working with senior executives and key stakeholders',
    'Experience in the financial services industry and payments ecosystem',
  ],
});

const SCALEOPS = buildJobDataFromExtractedJson({
  job_title: 'Head of Partnerships',
  company_name: 'ScaleOps',
  requirements: [
    'Strong understanding of public cloud, DevOps ecosystems, and subscription/SaaS business models',
    'Experience structuring complex partnerships and co-selling motions',
    'Deep knowledge of software channel and alliance business models',
    'Demonstrated success building and scaling partner ecosystems globally',
  ],
});

// A truthfully optimized BD resume that adopts the JD vocabulary it supports.
const OPTIMIZED_RESUME = `
  Business Development Manager. Conducted market research and market analysis of
  industry trends and competitive landscapes. Developed and led strategic
  partnerships across the financial services and payments sector. Led negotiations
  and closed commercial agreements with strategic partners. Drove cross-functional
  growth initiatives. Worked with senior executives and key stakeholders.
  HSBC Global Liquidity Management, Corporate Banking. Strategy consulting at EY.
`;

function inputFor(jobData: ReturnType<typeof buildJobDataFromExtractedJson>): AnalyzerInput {
  return {
    resume_text: OPTIMIZED_RESUME,
    job_text: '',
    job_data: jobData,
  } as unknown as AnalyzerInput;
}

describe('keyword-exact end-to-end (atomized + proportional)', () => {
  it('crosses the semantic-uncap threshold for a qualified, optimized candidate', async () => {
    const res = await new KeywordExactAnalyzer().analyze(inputFor(CAL));
    // Old binary gate produced ~9; atomized + optimized prototype produced ~63.
    expect(res.score).toBeGreaterThan(40);
  });

  it('does NOT inflate a genuine domain mismatch (finance resume vs cloud role)', async () => {
    const res = await new KeywordExactAnalyzer().analyze(inputFor(SCALEOPS));
    expect(res.score).toBeLessThan(30);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest tests/unit/ats-keyword-exact-coverage.test.ts 2>&1 | tail -25`
Expected: FAIL — the analyzer still uses binary matched-count.

- [ ] **Step 3: Switch the analyzer to coverage scoring**

In `src/lib/ats/analyzers/keyword-exact.ts`, change the import `scoreSkillListMatch` → `scoreSkillCoverage`, then replace the matching + earned-points block:

```ts
      const mustHaveResult = scoreSkillCoverage(mustHaveSkills, input.resume_text);
      const niceToHaveResult = scoreSkillCoverage(niceToHaveSkills, input.resume_text);

      const mustHaveWeight = KEYWORD_THRESHOLDS.must_have_weight;
      const niceToHaveWeight = KEYWORD_THRESHOLDS.nice_to_have_weight;

      const totalPossiblePoints =
        mustHaveSkills.length * mustHaveWeight + niceToHaveSkills.length * niceToHaveWeight;

      let score: number;
      if (totalPossiblePoints === 0) {
        score = 50;
      } else {
        const mustEarned = (mustHaveResult.score / 100) * mustHaveSkills.length * mustHaveWeight;
        const niceEarned = (niceToHaveResult.score / 100) * niceToHaveSkills.length * niceToHaveWeight;
        score = this.safeDivide(mustEarned + niceEarned, totalPossiblePoints) * 100;
      }
```

The evidence object's `matched`/`missing`/count fields keep working — `scoreSkillCoverage` returns the same shape.

- [ ] **Step 4: Run to confirm pass**

Run: `npx jest tests/unit/ats-keyword-exact-coverage.test.ts 2>&1 | tail -25`
Expected: PASS — Cal > 40, ScaleOps < 30.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ats/analyzers/keyword-exact.ts tests/unit/ats-keyword-exact-coverage.test.ts
git commit -m "feat(ats): score keyword_exact by proportional coverage of atomized keywords"
```

---

## Task 5: Full-suite regression, lint, calibration

**Files:** none new — verification only.

- [ ] **Step 1: Run the whole ATS unit suite**

Run: `npx jest tests/unit 2>&1 | tail -30`
Expected: all PASS. If `ats-prepare-input` / `ats-keyword-extraction` assert exact `keyword_exact` numbers or exact `must_have` arrays, update those expectations to the new atomized/proportional outputs; never weaken the ScaleOps "no inflation" assertion.

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint 2>&1 | tail -15`
Expected: 0 errors. (~21 pre-existing `tsc` errors live only in `tests/`; confirm none are in the five `src/` files touched here.)

- [ ] **Step 3: Manual sanity check against the live JD (optional, needs OPENAI_API_KEY)**

If a local `.env.local` OpenAI key is available, run the optimizer + full scorer on the real Cal JD and a sample resume; confirm the optimized `keyword_exact` clears 40 and the reported overall lands in the ~55–65% band. If no key, the Task 4 regression is the binding evidence.

- [ ] **Step 4: Commit any recalibration**

```bash
git add -A
git commit -m "test(ats): recalibrate expectations for atomized + proportional keyword scoring"
```

---

## Out of Scope (follow-ups)

- Re-scoring historical optimization rows already stored in the DB.
- Re-weighting `keyword_phrase` (12%, verbatim n-grams) — separate documented weakness.
- Surfacing atomized keywords in the UI's "missing keywords" panel (they will already improve, but UI copy review is separate).

---

## Self-Review

- **Spec coverage:** atomizer → Task 1; proportional matcher → Task 2; shared-chokepoint wiring (fixes optimizer + scorer) → Task 3; analyzer + no-inflation guarantee → Task 4; regressions/lint → Task 5.
- **Type consistency:** `scoreSkillCoverage` mirrors `scoreSkillListMatch`'s `{ matched, missing, score }`; `skillCoverage` and `extractSkillPhrases` return `number` and `string[]`. `buildJobDataFromExtractedJson` return type is unchanged (only `must_have`/`nice_to_have` contents change).
- **No placeholders:** every step has concrete code/commands; fixtures are the real scraped JD content.
- **Expected-number honesty:** Cal asserted as `> 40` (prototype 63), ScaleOps `< 30` — ranges, because exact values depend on tokenization, not on an unrun guess.
- **Blast-radius note:** atomization changes `must_have` contents consumed by the scorer, the optimizer gap list, and keyword-exact evidence. That is the intended fix; Task 5 Step 1 guards the rest of the suite.
