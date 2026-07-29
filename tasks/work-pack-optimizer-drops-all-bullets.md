# WP-64 — The optimizer silently deletes every experience bullet when the model names the key `responsibilities`

**Filed:** 2026-07-29
**Severity:** P0 on output correctness. The user receives a resume with their entire work history reduced to job titles and dates, and the product tells them it improved.
**Reported by:** founder, from a live run on iOS 1.4.7 (17), 2026-07-29 05:16 UTC. Wording: "the optimized resume looks very lean, it cut all my experience."
**Status:** Root cause confirmed against production data. No fix applied.

## What happens

`RESUME_OPTIMIZATION_SYSTEM_PROMPT` (`src/lib/prompts/resume-optimizer.ts`) specifies the per-role bullet array as `achievements`. The model **sometimes returns `responsibilities` instead**, with `achievements` present but empty.

Every consumer in the codebase reads `achievements` and nothing reads `responsibilities` for resume experience:

| Consumer | Line | Behaviour when `achievements: []` |
|---|---|---|
| `src/components/design/DesignRenderer.tsx` | 525 | `Array.isArray(exp.achievements) && exp.achievements.length > 0` guard fails, bullet list not rendered |
| `src/components/templates/ats-resume-template.tsx` | 118 | same guard, renders nothing |
| `src/app/api/v1/optimizations/[id]/route.ts` | 60 | `bullets` resolves to empty |
| `src/lib/ats/integration.ts` | 102 | scorer never sees the bullet text |

The `responsibilities` matches elsewhere in the codebase are all **job-description** parsing (`job-data-resolver.ts`, `ats-check/route.ts`), a different object. Nothing anywhere reads a resume role's `responsibilities`.

Net effect: the role survives (title, company, location, dates) and every bullet under it is discarded. The document is structurally intact and substantively empty, which is exactly why it reads as "lean" rather than "broken".

## The founder's run, measured

Optimization `0f3f0f89-374e-434f-9cbc-ac771623786f`, 2026-07-29 05:16:01 UTC.

- 5 roles returned, all 5 with `achievements: []` (type `array`, length 0)
- `responsibilities` populated on all 5: 3, 4, 4, 4, 3 = **18 bullets discarded**
- `ats_score_original` **38** → `ats_score_optimized` **61**

**The score rose 23 points on a resume that lost its entire achievement history.** `integration.ts:102` builds the scored text from `achievements`, so the scorer also saw zero bullets and still scored the result higher, on summary and skills alone. This is the sharpest available statement of the problem: the product deleted the user's evidence and rewarded itself for it.

## Scope, stated honestly

Across all 384 stored optimizations carrying an `experience` array:

- **12 rows lost every bullet this way** (3.1% overall), earliest 2026-05-28, most recent 2026-07-29
- 372 rows returned `achievements` normally
- 0 rows had no bullets in either key

All 12 belong to one `user_id` (`9fa6c1f5…`, the founder). **This is not evidence the defect is specific to one resume.** That account holds 357 of the 384 optimizations (93%); the other 20 users have 27 runs between them. At the observed 3.4% per-run rate, 27 runs would be expected to produce roughly one event, so observing zero is entirely consistent with the same background rate applying to everyone. **The data cannot distinguish "triggered by this particular resume" from "3.4% of all runs, for everyone."** Do not report it as founder-only.

A plausible but unverified trigger: the source resume uses "Responsibilities" as a section heading under each role, and the model mirrors the source's vocabulary over the schema's. Testable by running a resume with and without that heading.

## Why nothing caught it

1. **No output-shape validation.** `optimize-pipeline.ts` maps over `resume.experience` (lines 113, 150) and never asserts that bullets exist, that the count is plausible, or that the input's bullet count survived.
2. **No preservation rule in the prompt.** The system prompt says "Keep sections complete" but never states that every role in the original must appear in the output with its bullets. The JSON schema example shows a single experience entry with two bullets, which is a shape hint the model can follow literally.
3. **The second pass cannot repair it.** `RESUME_OPTIMIZATION_GAP_PROMPT` takes pass 1's output as "starting point" and never receives the original resume. Anything dropped in pass 1 is unrecoverable by design, so loss is monotonic across passes.
4. **The score moved the wrong way**, so no automated signal fired. `assessLift` and the never-decrease floor are both satisfied by a resume that improved on paper while losing its content.

## Recommended fix, smallest first

1. **Normalize at the parse boundary** (highest value, lowest risk). Where the model's JSON is parsed in `optimize-pipeline.ts`, coalesce bullet keys: accept `achievements`, `responsibilities`, `bullets`, `highlights`, whichever is non-empty, and write the result to `achievements`. This alone recovers all 12 historical cases and any future key drift.
2. **Add a preservation invariant.** After parsing, compare the output's total bullet count against the input's. If the output has zero bullets while the input had any, or the count collapses beyond a threshold, fail the pass and retry rather than returning it. WP-45 S2 already established the precedent that a pass must be compared against the original, not only against the other pass.
3. **Tighten the prompt.** State explicitly that every role present in the original must appear in the output with its bullets, and that `achievements` is the only accepted key name. Consider `response_format: json_schema` with a strict schema so the key name is enforced by the API rather than by instruction.
4. **Backfill the 12 affected rows** by moving `responsibilities` into `achievements`, so those users' stored optimizations stop rendering empty.
5. **Re-score after the fix.** The 38 → 61 on the founder's run is not a valid measurement of anything and should not enter any activation or quality series.

## Reproduction

```sql
-- rows where every bullet was discarded
select o.id, o.created_at,
  (select coalesce(sum(jsonb_array_length(coalesce(e->'responsibilities','[]'::jsonb))),0)
     from jsonb_array_elements(o.rewrite_data->'experience') e) as lost_bullets
from optimizations o
where o.rewrite_data ? 'experience'
  and (select coalesce(sum(jsonb_array_length(coalesce(e->'achievements','[]'::jsonb))),0)
         from jsonb_array_elements(o.rewrite_data->'experience') e) = 0
order by o.created_at desc;
```

Supabase project `brtdyamysfmctrhuankn` (ResumeBuilder AI). Read-only; nothing was modified during this investigation.

## Related

- The 2026-07-27 entry in the iOS repo's `tasks/progress.md` already recorded "the optimizer still degrades resumes" (`keyword_exact` 60 → 40) and asked for its own packet. **This is a different and more severe defect than that one** — that is a scoring regression, this is content deletion — but both point at the same gap: nothing validates the optimizer's output against its input.
- WP-45 S2 introduced `src/lib/ats/lift.ts` and the no-regression invariant for *scores*. The same discipline does not exist for *content*.
