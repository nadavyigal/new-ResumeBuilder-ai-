# R1: AI cost per optimization and per tailored export

- **Read on:** 2026-10-14. Window: the 30 days to 2026-10-14 (Supabase `now() - interval '30 days'`).
- **Closes:** P1 price floor in `docs/plans/2026-10-14-market-play-implementation.md` (D1: packs $3.99 / 1, $12.99 / 5, $19.99 / 10 tailored exports).
- **Status:** measured. Spend per call is read from PostHog LLM analytics, project 270848, on 2026-10-14 (section 1b), and re-run on 2026-10-15 with identical totals (section 1c). The OpenAI bill was not read; it serves only as a ceiling check (section 6) and does not change the result.

## 1. Verdict

**Measured: one real optimization costs $0.028 in traced OpenAI calls** (3 real runs: $0.024, $0.029, $0.032), about **$0.031 with the two untraced calls added**. That is about 65 times under the June spec's $2 alarm line. **One tailored export cost $0.022** in this window (4 exports by 3 real users). After Apple's 30% cut every pack keeps about 98% of net revenue per export.

The sample is tiny: 3 real optimizations and 4 exports in 30 days. The per-run cost is stable, though: all 12 runs, QA included, fall between $0.018 and $0.032, because every run makes exactly 2 gpt-4o calls of similar size. Cost would have to be about 45 times higher before the 10-pack at a 30% cut stops covering AI.

## 1b. Measured (PostHog project 270848, read 2026-10-14)

**Project check.** `/api/projects/270848/` returned name "ResumeBuilder AI"; the project holds `$ai_generation` (`$ai_lib = resumely-posthog-node`), `optimization_review_created` and `export_success`, and its first and last optimize calls (09-15 12:06, 10-13 10:03 UTC) match the Supabase rows in section 3. Queries ran through the SQL endpoint in the founder's signed-in Chrome session.

**Spend by surface, last 30 days** (query A, section 6). PostHog fills `$ai_total_cost_usd` itself; hand check: 47,351 × $2.50/M + 14,571 × $10/M = $0.264, the same.

| Surface | Model | Calls | Input tokens | Output tokens | Cost | Repair calls |
|---|---|---|---|---|---|---|
| optimize | gpt-4o-2024-08-06 | 24 | 47,351 | 14,571 | $0.2641 | 0 |
| ats-check (free check) | gpt-4o-mini-2024-07-18 | 20 | 18,599 | 7,553 | $0.0073 | |
| expert-mode | gpt-4o-mini-2024-07-18 | 2 | 2,647 | 1,533 | $0.0013 | |

No errors on any call. Eval runs do not appear (the nightly workflow has no PostHog key).

**Per optimization.** Calls grouped by user, with a new run after a gap of more than 120 seconds: 12 runs, each exactly 2 calls (pass 1 and pass 2), matching the 12 Supabase rows.

| Set | Runs | Mean | Median | p90 | Min | Max |
|---|---|---|---|---|---|---|
| All, traced calls | 12 | $0.0220 | $0.0203 | $0.0286 | $0.0184 | $0.0321 |
| **Real users, traced calls** | **3** | **$0.0284** | **$0.0286** | $0.0321 | $0.0244 | $0.0321 |
| Real users, plus untraced parse and embeddings (estimated, section 4) | 3 | about $0.031 | | | | |

**Excluded as likely QA (an inference, not a proven identity):** users `a861585f` (6 runs) and `dea55ea9` (3 runs). Neither sent a single client event in 30 days (no app launch, no page view), only server events. One run from each had identical token counts (1,912 in, 528 out), meaning the same input fixture, and the runs fell on 10-12 and 10-13 while #169 was being verified. All 20 free-check calls are on 2026-10-11, the day of #167's six live preview runs, so they are QA as well. No PostHog person with a founder or QA email (`%nadav%`, `%+%qa%`, `%fable%`) appears on any AI or export event.

**Exports** (`export_success`, query C): 4, by 3 people, all real: 09-15 web PDF, 09-21 iOS, 09-28 web PDF and 09-28 iOS. Real AI spend in the window: $0.0852 optimize + $0.0013 expert-mode + $0 free check = $0.0865, so **$0.022 per export** ($0.024 with the untraced calls). With QA spend left in, $0.2727 ÷ 4 = $0.068.

**Free check, per run:** $0.00037 per call; 20 calls over 15 checks is about **$0.0005 per free check**.

**Estimate against measured.** The token estimate (section 4) said $0.034 mean for the same 12 runs; measured is $0.022, so the estimate is 55% high and **the measured number is the one to use**. The estimate's character-per-token rule is deliberately pessimistic, most of all for Hebrew: the 5,676-character Hebrew run was estimated at 5,510 input tokens and measured at 2,113.

## 1c. Re-check, 2026-10-15

Query A re-run for 2026-09-14 to 2026-10-15: optimize 24 calls, 47,351 in, 14,571 out, $0.2641; ats-check 20 calls, $0.0073; expert-mode 2 calls, $0.0013. Identical to section 1b; no optimize call after 2026-10-13. Query B (sessionized, section 6) reproduced the same 12 runs and per-run costs.

**The QA split is weaker than section 1b says.** User `2c8c3ebb`, counted as real, also has only server events in PostHog (`optimization_completed`, `$ai_generation`, `optimization_review_created`), the same signature used to exclude `a861585f` and `dea55ea9`. iOS users can send client events under a different distinct id (an iOS export on 09-21 came from another id), so "no client events" does not prove QA. Read the split as a likely label. The verdict does not depend on it: with every run counted, the mean is $0.022 and the maximum $0.032.

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
| Likely QA | user `a861585f`: 6 runs, 5 of them in 13 minutes on 2026-10-13; user `dea55ea9`: 3 runs in 12 minutes on 2026-10-12 | Resumes 808 to 1,067 characters, job ads 1,880 to 2,340 characters, the same day #169 was being verified. Confirmed as QA in section 1b: server events only, a repeated input fixture |
| Free checks, `anonymous_ats_scores` | **15**, 15 sessions | Resumes average 848 characters (max 967): also test-sized |
| Exports | 4 in PostHog (section 1b). **Not in Supabase.** `optimizations.output_paths` is empty on all 12; `events` table is empty. Exports exist only as PostHog `export_success` (`src/app/api/download/[id]/route.ts:178`) | |

Real-user volume is 3 optimizations (section 1b). Any per-unit number from this window is a small sample.

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
| Same worst path with SDK retries: production clients set no `maxRetries` (`src/lib/openai.ts:14`), so openai 5.x retries a failed or timed-out call twice; a call the server already processed can be billed up to 3 times | up to $0.81 | |

gpt-4o is 95% or more of it; the parse call is $0.0003 to $0.0033 and embeddings under $0.0004. So PostHog `optimize` traces should land within about 10% of the full per-run cost.

Free check: about 1,600 input and 500 output tokens per quick-wins call at gpt-4o-mini prices, so about **$0.0005 per call, $0.0013 with the repair round**. Rounding, under $0.002 per free check.

## 5. Margin per pack

Net = price × (1 − Apple cut). AI cost per export uses the measured real-user cost per optimization with the untraced calls added, $0.031, and assumes one optimization per export (the window had 3 real optimizations for 4 exports). The worst-path column is the section 4 estimate.

Even the retried worst path (about $0.81) leaves every pack positive at a 30% cut: $1.98, $1.01 and $0.59 per export.

| Pack | Price per export | Net at 15% | Net at 30% | Margin at 30%, measured $0.031 | Margin at 30%, worst path $0.271 | Margin at 30% if AI cost were $2 |
|---|---|---|---|---|---|---|
| 1 for $3.99 | $3.99 | $3.39 | $2.79 | $2.76 (99%) | $2.52 (90%) | $0.79 |
| 5 for $12.99 | $2.60 | $2.21 | $1.82 | $1.79 (98%) | $1.55 (85%) | −$0.18 |
| 10 for $19.99 | $2.00 | $1.70 | $1.40 | $1.37 (98%) | $1.13 (81%) | −$0.60 |

At 15% each margin is $0.60 per export higher on the 1-pack, $0.39 on the 5-pack, $0.30 on the 10-pack.

**Cost per tailored export** = (AI cost of all real optimizations + free checks in the window) ÷ `export_success` count = **$0.022 measured** (section 1b). If users optimize several times per export, it scales like this at the measured $0.031 per optimization (free checks add about $0.0005 each):

| Optimizations per export | AI cost per export |
|---|---|
| 1 (every optimization is exported) | $0.03 |
| 2 | $0.06 |
| 5 | $0.16 |
| 10 | $0.31 |

The 10-pack at a 30% cut nets $1.40 per export, so it stays positive up to about 45 optimizations per export at the measured cost.

Not modelled: VAT or sales tax that Apple deducts before its cut in some regions (Israel included), Vercel and Supabase cost per user, and free users' AI cost (free check plus one free export) as acquisition cost.

## 6. Re-running the measurement

**Preferred: PostHog LLM analytics, project 270848** (used on 2026-10-14). Sign in at us.posthog.com, switch project explicitly to 270848, fingerprint it (the event list must contain `optimization_review_created` and `$ai_generation` with `$ai_lib = resumely-posthog-node`), then run in SQL insights:

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

-- B. one row per optimization run: calls of one user split into runs at a gap over 120 seconds
SELECT left(distinct_id, 8) AS user8, run_no, count() AS calls, min(ts) AS started,
       round(sum(cost), 4) AS run_cost, sum(inp) AS input_tokens, sum(outp) AS output_tokens
FROM (
  SELECT distinct_id, timestamp AS ts,
         toFloat(properties.$ai_total_cost_usd) AS cost,
         toFloat(properties.$ai_input_tokens) AS inp,
         toFloat(properties.$ai_output_tokens) AS outp,
         sum(is_new) OVER (PARTITION BY distinct_id ORDER BY timestamp
                           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run_no
  FROM (
    SELECT distinct_id, timestamp, properties,
           if(dateDiff('second', lagInFrame(timestamp) OVER (PARTITION BY distinct_id ORDER BY timestamp
                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING), timestamp) > 120
              OR row_number() OVER (PARTITION BY distinct_id ORDER BY timestamp) = 1, 1, 0) AS is_new
    FROM events
    WHERE event = '$ai_generation'
      AND properties.$ai_trace_name = 'optimize'
      AND timestamp >= now() - INTERVAL 30 DAY
  )
)
GROUP BY user8, run_no
ORDER BY started

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

- Read the OpenAI bill (Usage > Cost, 30 days, by model and key) once as a ceiling check: PostHog covers traced calls only and excludes evals by design.

- Give every optimization one shared `traceId` across its calls (`optimize-pipeline.ts`, both routes), so PostHog can give per-run median and p90 directly.
- Trace the two untraced calls on the optimize path: `parseResumeToCanonical` and embeddings.
- gpt-4o and gpt-4o-mini are marked Deprecated on OpenAI's model pages (read 2026-10-14). A forced model change will move this cost in either direction; re-run section 7 when it happens.
