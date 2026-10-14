# R1: AI cost per optimization and per tailored export

- **Read on:** 2026-10-14. Window: the 30 days to 2026-10-14 (Supabase `now() - interval '30 days'`).
- **Closes:** P1 price floor in `docs/plans/2026-10-14-market-play-implementation.md` (D1: packs $3.99 / 1, $12.99 / 5, $19.99 / 10 tailored exports).
- **Status:** partial. The estimate and the denominator are measured. The **measured spend** (numerator) is still open: PostHog and the OpenAI dashboard were both signed out in this session, and no admin key exists locally. Section 6 is the exact step that closes it.

## 1. Verdict

At list prices and the real text sizes of this window, one optimization costs about **$0.03** in OpenAI calls (median $0.028, p90 $0.048), **$0.05 to $0.10** when the truth-repair call fires, and **$0.27** on the worst path the code allows. That is 20 to 70 times under the June spec's $2 alarm line. After Apple's 30% cut every pack keeps about 98% of net revenue at the typical cost and at least 81% on the worst path.

This is an estimate, not a bill. The measured number in section 6 can move it. It would have to be about 40 times higher before the 10-pack at a 30% cut stops covering AI cost.

## 2. What runs on one optimization

Both entry points, `POST /api/optimize` (`src/app/api/optimize/route.ts:147`) and `POST /api/upload-resume` (`src/app/api/upload-resume/route.ts:251`), call `runOptimizePipeline` (`src/lib/ai-optimizer/optimize-pipeline.ts:261`).

| # | Call | Model | When | Traced in PostHog |
|---|---|---|---|---|
| 1 | Pass 1 gap rewrite, `callOpenAIWithGapPrompt` (`optimize-pipeline.ts:79`) | gpt-4o, max 4,000 out (`src/lib/prompts/resume-optimizer.ts:136`) | Always | Yes, `$ai_trace_name = optimize` |
| 2 | Fallback `optimizeResume` (`src/lib/ai-optimizer/index.ts:111`) | gpt-4o | Only if pass 1 fails | Yes, `optimize` |
| 3 | WP-64 zero-bullet retry, `optimizeResume` (`optimize-pipeline.ts:385`) | gpt-4o | Only if pass 1 returns roles with no bullets | Yes, `optimize` |
| 4 | Pass 2 gap rewrite (`optimize-pipeline.ts:434`) | gpt-4o | When score < 75, gain < 10, or no meaningful lift. **All 12 runs in this window met that test** (scores below) | Yes, `optimize` |
| 5 | Truth repair (`optimize-pipeline.ts:275`) | gpt-4o | Only when the job-ad terms guard finds unsupported or lost terms | Yes, `optimize` with `truth_repair: true` |
| 6 | Resume parse, `parseResumeToCanonical` (`src/lib/resume/canonicalize.ts:270`), via `ensureCanonicalResume` (`src/lib/optimization-review/service.ts:109`) | gpt-4o-mini | When the resume has no stored canonical JSON | **No** (direct SDK call) |
| 7 | ATS semantic score, `getEmbedding` (`src/lib/ats/utils/embeddings.ts:89`) via `src/lib/ats/analyzers/semantic.ts:50` | text-embedding-3-small | Every scoring pass (1 to 3 per run), in-memory cache | **No** |

Free check (`src/app/api/public/ats-check/route.ts:253`): quick wins, `src/lib/ats/quick-wins/generator.ts:132`, gpt-4o-mini, max 2,000 out, one call plus at most one repair round. Traced as `ats-check`. Plus embeddings (untraced).

Other OpenAI users that share the key but are **not** per-optimization cost: chat (`src/lib/chat-manager/ai-client.ts:82`, gpt-4), the Assistants thread manager (`assistant-manager.ts:15`, gpt-4-1106-preview), expert workflows (`src/lib/expert-workflows/prompts/*`, gpt-4o and gpt-4o-mini, traced `expert-mode`), refine-section (gpt-4o-mini, traced `refine-section`), design recommender (`src/lib/design-manager/design-recommender.ts:42`, gpt-4, untraced), amendment generator (`src/lib/ats/amendment-generator.ts:157`, gpt-4o-mini, untraced), agent intents and planner (gpt-4o-mini, untraced).

**What the repo records about cost:** `src/lib/posthog-ai.ts` sends one `$ai_generation` event per traced call with `$ai_model`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_trace_name`, `distinct_id` = user id. It sends **no cost field** and no shared trace id per optimization (each call gets a fresh UUID), so calls of one optimization are grouped by user and time, not by id. The repo's price table is `evals/resume-optimizer/call-ledger.ts:63`.

## 3. Denominator: optimizations in the window (Supabase, read 2026-10-14)

Project `brtdyamysfmctrhuankn` (ResumeBuilder AI).

| Measure | Count | Note |
|---|---|---|
| `optimizations` rows | **12**, 5 users, all `status = completed` | 0 rows from emails matching `nadav.yigal%`, `+qa`, `test` |
| `optimization_review_runs` | 12, all applied | One per pipeline run, matches the above |
| Users | 4 anonymous (iOS app sign-in), 1 email | |
| Likely QA | user `a861585f`: 6 runs, 5 of them in 13 minutes on 2026-10-13; user `dea55ea9`: 3 runs in 12 minutes on 2026-10-12 | Resumes 808 to 1,067 characters, job ads 1,880 to 2,340 characters, the same day #169 was being verified. Not confirmed: needs the PostHog person check (section 6) |
| Free checks, `anonymous_ats_scores` | **15**, 15 sessions | Resumes average 848 characters (max 967): also test-sized |
| Exports | **Not in Supabase.** `optimizations.output_paths` is empty on all 12; `events` table is empty. Exports exist only as PostHog `export_success` (`src/app/api/download/[id]/route.ts:178`) | |

Real-user volume is at most 12 optimizations and possibly 3. Any per-unit number from this window is a small sample.

Nightly eval spend shares the OpenAI bill: `.github/workflows/eval-resume-nightly.yml` ran **31 times** in the window (all success, `gh run list`), 7 cases each (`scripts/run-eval-resume.mjs:5`), so about **217 eval optimizations against 12 real ones**. The workflow sets only `OPENAI_API_KEY`, no PostHog key, so these calls do **not** reach PostHog. If the CI secret is the production key or the same OpenAI project, a raw "bill divided by optimizations" overstates the real cost by an order of magnitude.

## 4. Token-based estimate

**Prices**, read this session from OpenAI's model pages (developers.openai.com/api/docs/models/...), 2026-10-14: gpt-4o $2.50 in / $10.00 out per 1M tokens; gpt-4o-mini $0.15 / $0.60. Both pages mark the model **Deprecated**. text-embedding-3-small $0.02 is from the repo table (checked 2026-09-24), not re-read.

**Method** (script in section 7): the real prompt builders from `src/lib/prompts/resume-optimizer.ts`, filled with text of each run's real resume, job ad and output lengths from Supabase. Tokens by the repo's own heuristic (`evals/resume-optimizer/estimate.ts:28`: 3.5 Latin or 1.5 Hebrew characters per token). Output = stored optimized JSON length + 15%. Pass 2 counted on every run (section 2, row 4).

| Per optimization (12 runs) | Pass 1 + pass 2 + parse + embeddings | + truth repair |
|---|---|---|
| Mean | $0.034 | $0.051 |
| Median | $0.028 | |
| p90 | $0.048 | |
| Max (5,676-char Hebrew resume) | $0.063 | $0.100 |
| Worst path (pass 1 fails and is billed, fallback, WP-64 retry, pass 2, repair, every call at 4,000 output tokens, largest resume) | $0.271 | |

gpt-4o is 95% or more of it; the parse call is $0.0003 to $0.0033 and embeddings under $0.0004. So PostHog `optimize` traces should land within about 10% of the full per-run cost.

Free check: about 1,600 input and 500 output tokens per quick-wins call at gpt-4o-mini prices, so about **$0.0005 per call, $0.0013 with the repair round**. Rounding, under $0.002 per free check.

## 5. Margin per pack

Net = price × (1 − Apple cut). AI cost per export assumes one optimization per export (estimate, section 4).

| Pack | Price per export | Net at 15% | Net at 30% | Margin at 30%, typical $0.034 | Margin at 30%, worst $0.271 | Margin at 30% if AI cost were $2 |
|---|---|---|---|---|---|---|
| 1 for $3.99 | $3.99 | $3.39 | $2.79 | $2.76 (99%) | $2.52 (90%) | $0.79 |
| 5 for $12.99 | $2.60 | $2.21 | $1.82 | $1.79 (98%) | $1.55 (85%) | −$0.18 |
| 10 for $19.99 | $2.00 | $1.70 | $1.40 | $1.37 (98%) | $1.13 (81%) | −$0.60 |

At 15% each margin is $0.60 per export higher on the 1-pack, $0.39 on the 5-pack, $0.30 on the 10-pack.

**Cost per tailored export** = (AI cost of all optimizations + free checks in the window) ÷ `export_success` count. Exports are not yet read (section 6). Sensitivity at the typical estimate, adding $0.002 per free check:

| Optimizations per export | AI cost per export |
|---|---|
| 1 (every optimization is exported) | $0.04 |
| 2 | $0.07 |
| 5 | $0.17 |
| 10 | $0.34 |

The 10-pack at a 30% cut nets $1.40 per export, so it stays positive up to about 40 optimizations per export at today's estimate.

Not modelled: VAT or sales tax that Apple deducts before its cut in some regions (Israel included), Vercel and Supabase cost per user, and free users' AI cost (free check plus one free export) as acquisition cost.

## 6. Closing the measured number (what to run next)

**Preferred: PostHog LLM analytics, project 270848.** Sign in at us.posthog.com, switch project explicitly to 270848, fingerprint it (the event list must contain `optimization_review_created` and `$ai_generation` with `$ai_lib = resumely-posthog-node`), then run in SQL insights:

```sql
-- A. spend by surface and model, last 30 days
SELECT properties.$ai_trace_name AS surface,
       properties.$ai_model AS model,
       count() AS calls,
       sum(toFloat(properties.$ai_input_tokens)) AS input_tokens,
       sum(toFloat(properties.$ai_output_tokens)) AS output_tokens,
       sum(toFloat(properties.$ai_total_cost_usd)) AS posthog_cost_usd,
       countIf(properties.truth_repair = true) AS repair_calls
FROM events
WHERE event = '$ai_generation'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY surface, model
ORDER BY calls DESC

-- B. per-user optimize spend, to drop founder, QA and bursts
SELECT distinct_id,
       count() AS calls,
       min(timestamp) AS first_call,
       max(timestamp) AS last_call,
       sum(toFloat(properties.$ai_input_tokens)) AS input_tokens,
       sum(toFloat(properties.$ai_output_tokens)) AS output_tokens
FROM events
WHERE event = '$ai_generation'
  AND properties.$ai_trace_name = 'optimize'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY distinct_id
ORDER BY calls DESC

-- C. denominator and exports, split by emitter (optimization_completed meant two things before 2026-08-12)
SELECT event, properties.platform AS platform, properties.source AS source,
       count() AS n, uniq(distinct_id) AS users
FROM events
WHERE event IN ('optimization_completed', 'optimization_review_created', 'export_success', 'export_started')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY event, platform, source
ORDER BY event, n DESC
```

If `$ai_total_cost_usd` is empty, cost = input tokens × list input price + output tokens × list output price (section 4 prices). Exclude the founder's PostHog person and QA persons (for example `nadav.yigal+fable-qa-jul03@gmail.com`) and the bursts in section 3, then: cost per optimization = optimize cost ÷ optimizations; cost per export = (optimize + ats-check cost) ÷ `export_success`. Median and p90 need runs grouped by user and time gap, because traces carry no shared id per optimization.

**Fallback: OpenAI dashboard.** platform.openai.com > Usage > Cost, last 30 days, group by model and by project or API key. The production key's line is the numerator; the CI eval key and any dev key are shown apart. If both share one key, subtract the nightly eval (about 217 runs) using the per-run estimate in section 4 and say so.

**If the two methods disagree by more than 30%:** trust the PostHog per-call tokens for per-optimization cost (they are tied to real optimize calls and exclude evals), and use the OpenAI bill only as the ceiling on total spend.

## 7. Re-running the estimate

Copy `src/lib/prompts/resume-optimizer.ts` to a scratch folder as `prompts.ts`, pull the window's sizes with the SQL below, and run the script with `node --experimental-strip-types` (Node 22.6 or later; no install needed).

```sql
SELECT o.created_at, length(r.raw_text) AS resume_chars, length(o.jd_text) AS jd_chars,
       (r.raw_text ~ '[֐-׿]' OR o.jd_text ~ '[֐-׿]') AS hebrew,
       length(rr.optimized_resume_json::text) AS out_json_chars,
       length(r.canonical_data::text) AS canon_chars,
       o.ats_score_original, o.ats_score_optimized
FROM optimizations o
LEFT JOIN resumes r ON r.id = o.resume_id
LEFT JOIN LATERAL (
  SELECT optimized_resume_json FROM optimization_review_runs x
  WHERE x.resume_id = o.resume_id AND x.jd_id = o.jd_id
  ORDER BY abs(extract(epoch FROM x.created_at - o.created_at)) LIMIT 1
) rr ON true
WHERE o.created_at >= now() - interval '30 days'
ORDER BY o.created_at;
```

```js
// run.mjs, next to prompts.ts
import * as P from './prompts.ts';
const est = (t) => { const h = (t.match(/[֐-׿]/g) ?? []).length; return Math.ceil((t.length - h) / 3.5 + h / 1.5); };
const price = { 'gpt-4o': [2.5, 10], 'gpt-4o-mini': [0.15, 0.6], emb: [0.02, 0] }; // per 1M tokens, re-check on the model pages
const cost = (m, i, o) => (i * price[m][0] + o * price[m][1]) / 1e6;
const fill = (n, heb) => (heb ? 'א' : 'a').repeat(n);
const CANON_SYS = 1383; // characters of STRUCTURE_RESUME_SYSTEM_PROMPT, src/lib/resume/canonicalize.ts:4
const rows = [ /* [resume_chars, jd_chars, hebrew 0|1, out_json_chars, canon_chars] from the SQL above */ ];
const sys = est(P.RESUME_OPTIMIZATION_SYSTEM_PROMPT) + 80;
const gaps = { missingKeywords: Array(12).fill('keyword term'), lowSubscores: { a: 40, b: 50 }, mustHave: Array(12).fill('must have term') };
const typical = rows.map(([rc, jc, heb, oc, cc]) => {
  const R = fill(rc, heb), J = fill(jc, heb), O = fill(oc, heb), outTok = est(O) * 1.15;
  return cost('gpt-4o', sys + est(P.RESUME_OPTIMIZATION_GAP_PROMPT(R, J, gaps)), outTok)
    + cost('gpt-4o', sys + est(P.RESUME_OPTIMIZATION_GAP_PROMPT(O, J, gaps)), outTok)
    + cost('gpt-4o-mini', Math.ceil(CANON_SYS / 3.5) + est(R), est(fill(cc, heb)) * 1.15)
    + cost('emb', 3 * (est(J) + est(R) + est(O)), 0);
}).sort((a, b) => a - b);
console.log({ mean: typical.reduce((s, x) => s + x, 0) / typical.length, median: typical[Math.ceil(typical.length / 2) - 1], p90: typical[Math.ceil(typical.length * 0.9) - 1] });
```

Rows used on 2026-10-14: `[5676,18,1,2448,5917] [1633,766,1,1904,2568] [3421,1633,0,4356,5736] [845,2152,0,2087,1666] [1067,2145,0,2269,1632] [836,2105,0,1821,1238] [845,2152,0,2170,1666] [830,2340,0,2084,1272] [1012,2221,0,2275,1991] [808,2106,0,1906,1480] [904,2032,0,1964,1356] [904,1880,0,2058,1356]`.

## 8. Follow-ups found on the way (not done, no code changed)

- Give every optimization one shared `traceId` across its calls (`optimize-pipeline.ts`, both routes), so PostHog can give per-run median and p90 directly.
- Trace the two untraced calls on the optimize path: `parseResumeToCanonical` and embeddings.
- gpt-4o and gpt-4o-mini are marked Deprecated on OpenAI's model pages (read 2026-10-14). A forced model change will move this cost in either direction; re-run section 7 when it happens.
