# Planning Protocol — ResumeBuilder (Resumely)

> The mandatory planning flow before writing implementation code in this repo.
> Skipping it is how scope creep, broken tests, and wasted work get in.
>
> Added 2026-09-09. `~/.claude/CLAUDE.md` has told agents to follow
> `docs/agent-os/planning-protocol.md` for any task touching more than two files since
> at least August, but the file only existed in RunSmart. This repo is the primary
> product and had no planning gate at all.
>
> Related: `docs/agent-os/project-context.md` (scope, decisions, open questions),
> `tasks/lessons.md` (known recurring bugs), `CLAUDE.md` (commands and architecture).

---

## When This Protocol Applies

Apply it when:
- Implementing a new feature or user story
- Fixing a bug that touches more than one file
- Changing anything under `src/lib/` (shared utilities), `src/app/api/` (route contracts), or `supabase/migrations/`
- Changing scoring, optimization, or export behaviour
- Any change that could affect another screen, route, or the funnel

You may go straight to implementation for:
- Single-line typo or copy fixes
- Updating one hardcoded string
- A missing CSS class with no logic change

When in doubt, run the protocol.

---

## Protocol Steps

### Step 1 — Restate the objective

One sentence: what will exist or work after this change that does not now?

> Example: "The optimizer will stop lowering a resume's recency score when the user adds a
> more recent role."

If you cannot write that sentence because the task is ambiguous, stop and ask.

### Step 2 — Identify assumptions

List assumptions not stated in the task. For each, ask: if this is wrong, is the
implementation wrong? If yes, verify it or ask before proceeding.

> Example: "I assume the score is computed server-side in `src/lib/ats/`" — verify, do not assume.

### Step 3 — Inspect the real files

Before writing any code, read:

1. `tasks/lessons.md` — is this a known recurring bug with a documented fix path?
2. `docs/agent-os/project-context.md` — is the task in scope, and what has already been decided?
3. `tasks/ERRORS.md` and `~/.claude/ERRORS.md` — has this approach already failed? Never re-propose one that has.
4. The directly impacted source files. Read the current code; do not plan from memory.

Report what you found.

### Step 4 — Identify impacted areas

Every file that will change, with exact path, what changes, and why. If you discover a
file you did not expect to need, say so. More than 3 unexpected files means stop and
surface it, per global work rule 7.

### Step 5 — Define success criteria

2 to 5 acceptance criteria in Given / When / Then. Each independently testable.

**If the change touches a user-visible funnel step, one criterion must name the PostHog
event that proves it works.** "The AI call works" is not evidence; a captured event or a
test asserting it fires is.

### Step 6 — Check the measurement boundary

This product has dates across which its numbers cannot be compared: the 2026-06-18 score
engine change, the 2026-08-12 `optimization_completed` split, and the 2026-08-14 free ATS
score. If your change alters what an event means, how a score is computed, or what the
baseline is, say so explicitly in the plan and state the new boundary date. A silent
boundary is how "the score went down" became six code paths rewriting the baseline.

### Step 7 — Break into stories

More than one distinct change means ordered stories. Each story must be independently
committable: the app works after story N even if N+1 never starts. Do not span a Supabase
migration and a UI change in one story unless they are genuinely atomic. One story per
working session.

### Step 8 — Ask for approval before implementing

Present the plan and wait if any of these are true:

- It touches more than 3 files
- It changes anything in `src/lib/`
- It changes a Supabase migration, table, or RLS policy
- It changes an API route contract under `src/app/api/`
- It adds a dependency (`npm install`)
- It touches auth, Stripe, credits, or export
- The scope is larger than what was described

Approval format:

```
Objective: [one sentence]
Stories: [numbered list]
Files affected: [list]
Assumptions: [list]
Tests planned: [list]
Measurement boundary introduced: [date + what changed, or "none"]
Blockers or questions: [list, or "none"]

Ready to implement story 1. OK to proceed?
```

Do not start until you get a go-ahead.

### Step 9 — Implement one story at a time

After approval, implement story 1, then run, in order:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Report the commands you ran and their results. If you skipped a check, say why. Never
leave the suite red.

### Step 10 — Taste Check before you say done

Global work rule 12. Four answers, one line each:

1. Does this make the product better for its actual user?
2. Does it fit Resumely's voice: calm, honest, practical, confident? Fit before effort, not
   "pass ATS". Canonical source is `.agents/product-marketing.md` in the ResumeBuilder iOS repo.
3. Does it carry AI slop: warmup phrases, em dashes, hype, hedging, fake confidence scores?
4. Is it scoped to what was asked?

Any "no" is a REVISE, not a done. UI, user-facing AI output, and anything public-facing gets
the full pass in Agentic OS `GLOBAL-TASTE.md` with a PASS / REVISE / REJECT verdict.

### Step 11 — Close the loop

Update `tasks/progress.md` in the same response as the commit (global work rule 11). Push
and open a PR before declaring done (rule 16). Report `git status --short --branch` and
`git log --oneline @{u}..`.

Note: this repo's pre-commit secret-scan hook hangs under `git commit`. Run it standalone
first (about 50s, exit 0), then commit with `--no-verify`, and say in your report that you
did so and that the scan passed.
