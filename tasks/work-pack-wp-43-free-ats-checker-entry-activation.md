# Work Packet WP-43 — Free ATS Checker Entry-Funnel Activation (Tier A)

- Status: Ready for execution (Codex or Cursor). Not started.
- Created: 2026-07-11
- Source: Live cold first-time-user walkthrough of resumelybuilderai.com (Claude session 2026-07-11). Web twin of the iOS `picker → file-selected` PostHog drop. Companion packet: WP-44 (iOS upload activation).
- Mode: Builder — copy/design + light client logic only. NO backend changes in this packet (those are Tier B, listed at the end).
- Outcome loop: Resumely activation (20% / 30d target). This packet attacks the entry gate where cold web traffic bleeds before the first score.
- Repo: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`

## Why this packet exists

Walking the live funnel cold surfaced one dominant abort point: **the first-value gate is too heavy for the hero's promise.** The hero sells a "Free ATS Resume Check" (one thing: your resume), but to see any number the user must upload a PDF through an unstyled native file control AND paste a job description of 100+ words. Two non-trivial inputs plus mobile file-handling, all before payoff. Supporting friction: no above-the-fold action, account/login language surfacing before the tool, requirements revealed one at a time, and a LinkedIn-URL path that silently returns a garbage low score.

Key cross-surface finding: the **iOS app Home screen already does everything Tier A proposes** (above-the-fold CTA, branded dropzone, "PDF or DOCX · up to 5MB", location cues, Step-1-of-3 progressive disclosure). The web is behind the app. This packet ports that proven iOS design to web. All items below are copy/design or client-only and are safe to ship without touching the scoring backend.

## Files in scope

| File | Role |
|---|---|
| `src/components/landing/FreeATSChecker.tsx` | Hero + card wrapper (badge, title, bullets, login link, mobile stacking order). 311 lines. |
| `src/components/landing/UploadForm.tsx` | File input, JD text/URL toggle, word gate, submit + hint. 197 lines. |
| `src/messages-overrides/funnel/en.json` | Copy keys `landing.atsChecker.*`, `landing.uploadForm.*`. |
| `src/messages-overrides/funnel/he.json` | Hebrew (RTL) equivalents — REQUIRED for every new/changed key. |
| `tests/app/upload-form-validation-state.test.tsx` | Existing validation-state test — extend for the new checklist + LinkedIn guard. |
| `tests/app/free-ats-checker-failure-preserves-input.test.tsx` | Existing — keep green. |

Grounding facts verified in code:
- `UploadForm.tsx` file `<Input type="file" accept=".pdf,application/pdf" required />` — native control, PDF-only.
- Backend `src/app/api/public/ats-check/route.ts:146` rejects non-PDF (`isPdfUpload`). **Do NOT add `.docx` to `accept`** in this packet — it would let users select a file the backend then rejects. (Note: the iOS app DOES accept DOCX because it uses a different upload path; web free path does not.)
- `route.ts:100` skips the 100-word requirement when a URL is present (`wordCount < MIN && !hasUrlInput`). The URL path is genuinely the lighter, backend-supported route.
- `PUBLIC_ATS_MIN_JOB_DESCRIPTION_WORDS = 100` (`src/lib/ats/public-ats-check-constants.ts`).
- `UploadForm` already has a single-priority `submitHint`; the fix is to show ALL requirements at once, not to add a hint from scratch.

## Stories (each is one small, reviewable diff)

### S1 — Above-the-fold primary CTA (P1)
`FreeATSChecker.tsx` hero column (after `t("description")`, ~line 241) gains a button "Check my resume →" that smooth-scrolls to the upload card. Give the card wrapper (`FreeATSChecker.tsx:281`) an `id="ats-upload"` and have the button `scrollIntoView` (respect `prefers-reduced-motion`). New copy key `landing.atsChecker.heroCta`. Fire `posthog.capture("ats_checker_hero_cta_clicked")`.
- Acceptance: on mobile width, a primary action is visible without scrolling; tapping it brings the upload card into view and focuses the file input.

### S2 — Rebrand the native file input as a styled dropzone (P0)
`UploadForm.tsx` resume block (~lines 101-112). Wrap the `<input type="file">` in a styled, full-width label/drop area (visually consistent with `bg-card` + `border-2`), keep `accept=".pdf,application/pdf"` unchanged. Add helper line under it: "PDF only, up to 5MB. Processed privately, never stored." Keep the existing `selectedFile` confirmation. New copy keys `landing.uploadForm.dropzoneCta`, `landing.uploadForm.fileConstraints`.
- Acceptance: no raw "Choose File / No file chosen" default styling remains; tap target spans the card width; PDF-only expectation is stated before the user opens the picker; file still selects and `onFileSelected` still fires.

### S3 — Show all requirements at once (P1)
`UploadForm.tsx`. Replace the single-priority `submitHint` (lines ~59-72, rendered ~193-197) with a two-item checklist that reflects live state: "① Add your resume" (check when `resumeFile`) and "② Add a job description — 100+ words or a job link" (check when `hasJobInput && hasValidWordCount && hasValidUrl`). Keep it as `role="status"`. New copy keys `landing.uploadForm.checklist.resume`, `landing.uploadForm.checklist.job`.
- Acceptance: before any input, the user can see BOTH requirements simultaneously; each ticks independently as satisfied; the disabled button is never unexplained.

### S4 — Nudge short-text users to the URL path (P2)
`UploadForm.tsx` text branch, near the word counter (~lines 154-160). When `inputMode === "text" && hasStartedTextInput && !hasValidWordCount`, add one line: "Short on text? Switch to 'From URL' and paste the job link instead." New copy key `landing.uploadForm.shortTextNudge`.
- Acceptance: a user who pastes under 100 words is pointed at the backend-supported lighter path rather than just blocked by a red counter.

### S5 — LinkedIn URL guard (P1)
`UploadForm.tsx` URL branch (~lines 163-179). When the entered URL host includes `linkedin.com`, render an inline warning (reuse the `text-destructive` style already used for `invalidUrl`): "LinkedIn blocks automated fetch. Paste the description text instead for an accurate score." New copy key `landing.uploadForm.linkedinWarning`. (Grounded in the documented LinkedIn thin-scrape failure in this repo's own progress notes — datacenter IPs receive ~222 chars of degraded content, producing a false low score.)
- Acceptance: pasting any `linkedin.com/jobs/...` URL shows the warning; other hosts do not.

### S6 — Move login link below the tool on mobile (P2)
`FreeATSChecker.tsx` — the `existingAccount` + `loginLink` block (lines 268-278) sits in the hero column and renders above the form on mobile. Use responsive ordering (Tailwind `order-*` on the grid children, or move the block into the card footer on small screens) so account language appears AFTER the tool on mobile. Desktop two-column layout unchanged.
- Acceptance: on mobile, the upload card precedes the "Already have an account? Log in" line; desktop layout is visually unchanged.

## Constraints
- Copy/design + client logic only. No changes to `route.ts`, scoring, or `public-ats-check-constants.ts`.
- Every new/changed `en.json` key MUST get a Hebrew value in `he.json` (RTL). Verify `jq empty` (or `python3 -m json.tool`) on both after editing.
- Do not add `.docx` to the file `accept` (backend rejects it — see Tier B).
- Do not weaken the 100-word server gate; S4 only surfaces the existing URL escape hatch.

## Validation
- `npm run type-check` clean.
- `npx eslint` on changed files: 0 new errors.
- Extend `tests/app/upload-form-validation-state.test.tsx` to cover the S3 checklist states and the S5 LinkedIn warning; keep `free-ats-checker-failure-preserves-input.test.tsx` green.
- Manual smoke at mobile width: hero CTA visible above fold → scrolls to styled dropzone → checklist shows both items → LinkedIn URL warns → login link below the card.
- `git status --short --branch` + push + PR per session-end rule.

## Measurement (ties to the 07-18 / 07-25 funnel re-read)
- New event `ats_checker_hero_cta_clicked` (S1).
- Watch existing `ats_checker_submitted` volume and the PostHog `resume_file_picker → file-selected` proxy for lift after ship.
- Success signal: higher share of landers who reach `ats_checker_submitted`; specifically fewer sessions that select a resume but never submit.

## Tier B — deferred (needs backend, NOT in this packet)
- **DOCX support** for the free path (`route.ts` + `pdf-parser` / add a docx text extractor). The label can only honestly offer DOCX once the server accepts it.
- **Resume-only first score**: return a general ATS-readability score from the resume alone, then ask for the job description as step two to unlock the tailored match. This is the highest-leverage change (cuts first-value from two inputs to one and matches the hero promise) but requires a scoring path that runs without a JD.
