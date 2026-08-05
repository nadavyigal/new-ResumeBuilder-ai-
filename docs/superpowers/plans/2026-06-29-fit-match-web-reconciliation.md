# Fit/Match Web Copy Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every public-facing web surface in this repo into alignment with the canonical Fit/Match positioning locked in the iOS repo (`ResumeBuilder IOS APP/.agents/product-marketing.md`, updated 2026-06-28), removing "pass ATS" / "official ATS score" framing wherever it appears in marketing copy, while leaving factual/process descriptions of ATS mechanics intact.

**Architecture:** This is a copy-only reconciliation, not a feature build. No new components, no schema changes, no new dependencies. Every task edits existing i18n strings in `src/messages/en.json` (and the matching `src/messages/he.json` key when one exists) or existing markdown blog content. Each task is independently shippable — none depend on another's code changes, only on the canonical doc as the shared source of truth.

**Tech Stack:** Next.js App Router, `next-intl` for i18n (`src/messages/en.json`, `src/messages/he.json`), Vercel deploy.

## Global Constraints

- Canonical source of truth for product facts: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/ResumeBuilder IOS APP/.agents/product-marketing.md` (read it first, it may have changed since this plan was written).
- Banned words (verbatim from the canonical doc's "Words to avoid"): "pass ATS", "guaranteed", "beat the bots", "official ATS score", "get interviews", "pass filters", "auto-apply".
- Allowed words: "ATS-friendly" is fine in process-descriptive contexts (e.g. "ATS-friendly formatting"). Do not strip every mention of "ATS" — only the claim that the product makes a resume *pass* an ATS or reports an *official* ATS score.
- Words to use instead, per the canonical doc: "job fit", "Match Score", "Resumely Match Score", "tailored resume", "missing keywords", "top gaps", "targeted edits", "ATS-friendly", "export PDF".
- Hebrew copy must be authored, not auto-translated (repo convention, confirmed in `src/messages/he.json` history and CLAUDE.md project rules). If a task touches `he.json`, write natural Hebrew yourself — do not machine-translate the English string.
- No new npm dependencies. Flag before installing anything.
- Do not touch `docs/gtm/week-1-*` or `canonical-90-day-plan.md` — those are intentionally-preserved historical execution logs, not live copy (per `distribution-os/operating-principles.md` Principle 6 and the 2026-06-29 distribution-command-center decision).
- Scope gate: if you find this touching more than the files listed below, stop and surface it before continuing.

---

### Task 1: Reconcile the `/ats-checker` page metadata and App Store CTA

**Files:**
- Modify: `src/messages/en.json` — keys `atsCheckerPage.meta.title`, `atsCheckerPage.meta.description`
- Reference (no code change needed): `src/app/[locale]/ats-checker/page.tsx` — confirms these keys are consumed for `<title>`/`<meta description>` and OpenGraph tags

**Current strings (verified 2026-06-29):**
```json
"atsCheckerPage": {
  "meta": {
    "title": "Free ATS Resume Checker — See If Your Resume Passes",
    "description": "Paste your resume and job description. Get an instant Resumely Match Score and the top keyword gaps, based on how ATS systems parse resumes. Free, no sign-up required."
  }
}
```

The `title` violates "pass ATS." The `description` is already compliant (leads with "Resumely Match Score") — leave it.

- [ ] **Step 1: Read the current file to confirm nothing changed since this plan was written**

Run: `cat src/messages/en.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['atsCheckerPage']['meta'])"`
Expected: matches the "Current strings" block above. If it doesn't, stop and re-read the canonical doc before proceeding.

- [ ] **Step 2: Edit the title string**

In `src/messages/en.json`, change:
```json
"title": "Free ATS Resume Checker — See If Your Resume Passes",
```
to:
```json
"title": "Free Resume Match Score Checker — See What's Missing",
```

- [ ] **Step 3: Verify the banned phrase is gone**

Run: `grep -n "See If Your Resume Passes" src/messages/en.json`
Expected: no output (zero matches).

- [ ] **Step 4: Visually confirm in dev**

Run: `npm run dev` (if not already running), then open `http://localhost:3000/ats-checker` and check the browser tab title matches the new string.

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json
git commit -m "copy: remove pass-ATS framing from /ats-checker page title"
```

---

### Task 2: Reconcile the homepage hero copy

**Files:**
- Modify: `src/messages/en.json` — keys under `landing.hero`

**Current strings (verified 2026-06-29):**
```json
"hero": {
  "badge": "Used by Job Seekers Worldwide",
  "titleLine1": "Turn Your Resume Into",
  "titleLine2": "Interview Invitations",
  "subtitle": "Your resume gets 6 seconds of attention. Make every second count. Our AI matches your experience to what recruiters actually search for.",
  "benefits": ["Pass the 6-second scan test", "Match what recruiters search for", "See your score in 30 seconds"],
  "ctaPrimary": "Get My Free Match Score",
  "ctaSecondary": "See a Sample Report",
  "socialProof": {
    "atsApproved": "Built for ATS-safe formatting"
  }
}
```

`ctaPrimary` and `benefits[1]`/`benefits[2]` are already compliant. `benefits[0]` ("Pass the 6-second scan test") is about a *recruiter* skim, not an ATS claim — borderline but reads as ATS-adjacent given the page context; reword to remove ambiguity. `socialProof.atsApproved` implies a vendor approval that doesn't exist.

- [ ] **Step 1: Edit `benefits[0]`**

Change:
```json
"benefits": ["Pass the 6-second scan test", "Match what recruiters search for", "See your score in 30 seconds"],
```
to:
```json
"benefits": ["Built to survive the 6-second scan", "Match what recruiters search for", "See your score in 30 seconds"],
```

- [ ] **Step 2: Edit `socialProof.atsApproved`**

Change:
```json
"atsApproved": "Built for ATS-safe formatting"
```
to:
```json
"atsApproved": "ATS-friendly formatting, built in"
```

- [ ] **Step 3: Verify**

Run: `grep -n "ATS-safe formatting\|Pass the 6-second" src/messages/en.json`
Expected: no output.

- [ ] **Step 4: Visually confirm in dev**

Open `http://localhost:3000/` and check the hero benefits list and the social-proof badge under the fold render the new copy.

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json
git commit -m "copy: soften ATS-pass framing in homepage hero"
```

---

### Task 3: Reconcile footer, newsletter, and blog index copy

**Files:**
- Modify: `src/messages/en.json` — keys `footer.newsletterDescription`, `newsletter.note`, `blog.index.subtitle`

**Current strings (verified 2026-06-29):**
```json
"footer": {
  "newsletterDescription": "Get proven, ATS-aware resume strategies and practical job-search tips every week."
},
"newsletter": {
  "note": "Weekly resume tips and ATS insights. Unsubscribe anytime."
},
"blog": {
  "index": {
    "subtitle": "Expert advice on ATS optimization, resume writing, and landing your dream job."
  }
}
```

None of these use a literally banned phrase, but all three center the value prop on generic "ATS" framing instead of job-fit/tailoring, which is the new front-door story per the canonical doc ("Fit-First is the front-door story"). Low-risk, optional polish — do this task only after Tasks 1–2 land and only if you have remaining time in the session.

- [ ] **Step 1: Edit `footer.newsletterDescription`**

Change to:
```json
"newsletterDescription": "Get proven resume-tailoring strategies and practical job-search tips every week."
```

- [ ] **Step 2: Edit `newsletter.note`**

Change to:
```json
"note": "Weekly resume tips and job-search insights. Unsubscribe anytime."
```

- [ ] **Step 3: Edit `blog.index.subtitle`**

Change to:
```json
"subtitle": "Expert advice on resume tailoring, job fit, and landing your dream job."
```

- [ ] **Step 4: Verify**

Run: `grep -n "ATS-aware resume strategies\|ATS insights\|ATS optimization, resume writing" src/messages/en.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json
git commit -m "copy: lead footer/newsletter/blog-index copy with fit/tailoring, not generic ATS"
```

---

### Task 4: Author matching Hebrew updates for Tasks 1–3

**Files:**
- Modify: `src/messages/he.json` — Hebrew counterparts of every key touched in Tasks 1–3

**Why this is its own task:** the repo's Hebrew copy is authored, not machine-translated (confirmed by the existing `hebrew-program.md` convention and CLAUDE.md's project rule). This task cannot be done by literally translating the English strings above — write natural Hebrew that carries the same meaning and tone (calm, practical, non-alarmist, per the canonical doc's Brand Voice section).

- [ ] **Step 1: Find the current Hebrew strings**

Run:
```bash
python3 -c "
import json
d = json.load(open('src/messages/he.json'))
for path in ['atsCheckerPage.meta.title', 'landing.hero.benefits', 'landing.hero.socialProof.atsApproved', 'footer.newsletterDescription', 'newsletter.note', 'blog.index.subtitle']:
    cur = d
    for k in path.split('.'):
        cur = cur[k]
    print(path, '=', cur)
"
```

- [ ] **Step 2: Author Hebrew replacements**

For each key, write a Hebrew string that matches the *meaning* of the new English string from Tasks 1–3 (not a literal translation), in the same calm/practical tone used elsewhere in `he.json`. Read 5-10 neighboring Hebrew strings in the file first to match register and terminology already in use (e.g. how "התאמה"/match, "התאמה למשרה"/job match are already phrased elsewhere in the file — search for them first with `grep -n "התאמה" src/messages/he.json` so the new copy is consistent with existing Hebrew terminology, not a new coinage).

- [ ] **Step 3: Edit `src/messages/he.json` with the authored strings**

- [ ] **Step 4: Verify JSON is valid**

Run: `python3 -m json.tool src/messages/he.json > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 5: Visually confirm in dev**

Open `http://localhost:3000/he/ats-checker` and `http://localhost:3000/he` and confirm the Hebrew renders correctly RTL with no layout breakage from string length changes.

- [ ] **Step 6: Commit**

```bash
git add src/messages/he.json
git commit -m "copy(he): author Hebrew counterparts for fit/match reconciliation"
```

---

### Task 5: Retitle the two "pass ATS" blog posts

**Files:**
- Modify: `src/content/blog/en/how-to-beat-ats-systems-2025.md` (frontmatter `title`, `excerpt`, and the `# How to Pass ATS Screens in 2026` H1)
- Modify: `src/content/blog/en/ats-baseline-mistakes-2026.md` (frontmatter `title` only — its H1 doesn't use "pass")
- Check for Hebrew equivalents: `src/content/blog/he/` (verify whether matching Hebrew posts exist; if they do, repeat the title/H1 edit there with authored Hebrew per Task 4's approach, not translation)

**Current state (verified 2026-06-29):**

`how-to-beat-ats-systems-2025.md` frontmatter:
```yaml
title: "How to Pass ATS Screens in 2026: A Practical Resume Checklist"
excerpt: "A practical, evidence-first checklist to make your resume easier for ATS systems and recruiters to read."
```
and body H1: `# How to Pass ATS Screens in 2026`

`ats-baseline-mistakes-2026.md` frontmatter:
```yaml
title: "The 7 ATS Mistakes That Block Qualified Candidates (And How to Fix Them)"
```
This title doesn't use "pass" or "official score" — it's about avoiding mistakes, which is compliant. Leave its title as-is; only check its body for any "guaranteed"/"pass ATS" claims while you're in the file (see Step 3).

**Scope note:** this task retitles the posts and their H1s only. A full body rewrite of both posts is out of scope for this plan — flag it as a follow-up if you want the body content audited line by line. The body text is process-descriptive ("ATS systems parse resumes") which is allowed; only the headline-level "pass ATS" promise needs to go.

- [ ] **Step 1: Edit `how-to-beat-ats-systems-2025.md` frontmatter**

Change:
```yaml
title: "How to Pass ATS Screens in 2026: A Practical Resume Checklist"
```
to:
```yaml
title: "How to Tailor Your Resume for ATS Systems in 2026: A Practical Checklist"
```

- [ ] **Step 2: Edit the H1 in the same file**

Change:
```markdown
# How to Pass ATS Screens in 2026
```
to:
```markdown
# How to Tailor Your Resume for ATS Systems in 2026
```

- [ ] **Step 3: Scan both files for any other banned phrase**

Run:
```bash
grep -in "guaranteed\|beat the bots\|official ats score\|pass filters\|auto-apply" src/content/blog/en/how-to-beat-ats-systems-2025.md src/content/blog/en/ats-baseline-mistakes-2026.md
```
Expected: no output. If something matches, reword that sentence in place (don't rewrite the whole post).

- [ ] **Step 4: Check for and update Hebrew equivalents**

Run: `ls src/content/blog/he/ | grep -i "ats"`
If matching Hebrew posts exist, repeat Steps 1-3 with authored (not translated) Hebrew titles/H1s.

- [ ] **Step 5: Verify the blog index and post still build**

Run: `npm run build 2>&1 | tail -40`
Expected: build succeeds with no errors related to `src/content/blog/`.

- [ ] **Step 6: Commit**

```bash
git add src/content/blog/en/how-to-beat-ats-systems-2025.md
git commit -m "copy: retitle blog post away from pass-ATS framing"
```

---

### Task 6: Leave the in-app dashboard "ATS support" copy as-is, document why

**Files:**
- No file edits in this task — it's a documentation/decision task.

**Why this task exists:** The research pass for this plan found extensive "ATS support" / "ATS-friendly" / "ATS impact" copy throughout the authenticated dashboard (`dashboard.applications.detail.reports.atsImpact`, `dashboard.optimization.readiness.structureBadge`, `dashboard.ats.compact.title`, etc., all in `src/messages/en.json` under the `dashboard.*` namespace, rendered by `src/components/ats/ATSScoreCard.tsx`, `CompactATSScoreCard.tsx`, and `src/components/chat/ATSSuggestionsBanner.tsx`). None of it claims to "pass" an ATS or reports an "official" score — it consistently says "support," "impact," "friendly," "structure," which matches the canonical doc's allowed usage ("Keep 'ATS' for discoverability only in process-descriptive contexts"). This is intentionally out of scope for this plan.

- [ ] **Step 1: Confirm no dashboard string crosses the line**

Run:
```bash
python3 -c "
import json
d = json.load(open('src/messages/en.json'))
def find(d, path=''):
    if isinstance(d, dict):
        for k,v in d.items():
            find(v, path+'.'+k if path else k)
    elif isinstance(d, str) and path.startswith('dashboard'):
        low = d.lower()
        if any(b in low for b in ['pass ats', 'guaranteed', 'beat the bots', 'official ats score', 'pass filters', 'auto-apply']):
            print('VIOLATION:', path, '=', d)
find(d)
"
```
Expected: no output. If something prints, add a new sub-task to fix that specific string — do not bulk-edit the dashboard namespace.

- [ ] **Step 2: Note the decision in the distribution OS lessons file**

Append one row to `/Users/nadavyigal/Documents/Projects /Agentic OS/distribution-os/lessons.md` under "Cross-Product Patterns":
```markdown
| 2026-06-29 | Dashboard "ATS support/impact" copy is allowed under the canonical doc's process-descriptive carve-out; only public-marketing "pass ATS" claims needed reconciliation, not in-app labels | ResumeBuilder web dashboard | Verified via dashboard.* namespace scan, zero violations found |
```

- [ ] **Step 3: Commit (lessons file is in a different repo than the rest of this plan)**

```bash
cd "/Users/nadavyigal/Documents/Projects /Agentic OS" && git add distribution-os/lessons.md && git commit -m "lessons: confirm dashboard ATS copy is in-bounds, no edit needed"
```

---

## Self-Review Notes (for whoever executes this)

- **Spec coverage:** Task 1 covers the `/ats-checker` route's SEO metadata (the single most visible violation). Task 2 covers the homepage hero. Task 3 covers footer/newsletter/blog-index. Task 4 covers Hebrew parity. Task 5 covers the two blog post titles. Task 6 explicitly scopes OUT the dashboard copy with a verification step, so nothing gets silently missed.
- **What this plan deliberately does not touch:** `docs/gtm/week-1-*`, `canonical-90-day-plan.md` (historical logs, see Global Constraints), the body content of the two blog posts beyond title/H1 (flag as separate follow-up if wanted), and all `dashboard.*` copy (verified compliant in Task 6).
- **Before starting:** re-read `ResumeBuilder IOS APP/.agents/product-marketing.md` — if the founder has changed the canonical positioning since 2026-06-28, the target strings in this plan may be stale. Treat this plan's "current strings" snapshots as a diff base, not a guarantee.
