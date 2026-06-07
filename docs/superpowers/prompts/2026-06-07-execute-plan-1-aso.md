# Work Packet: Execute Plan 1 — Resumely ASO + Launch Assets

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`
**Plan file:** `docs/superpowers/plans/2026-06-07-resumely-plan-1-aso-launch-assets.md`
**Spec file:** `docs/superpowers/specs/2026-06-07-resumely-growth-pricing-design.md`

---

## Goal

Create all App Store and launch content for Resumely's App Store launch. This is pure content work — no code, no migrations, no dependencies to install. The output is a set of Markdown files committed to the repo that can be copy-pasted directly into App Store Connect and LinkedIn.

## Context

Resumely is a resume tailoring iOS app (Next.js web + Capacitor iOS) that uses AI to match a resume to a specific job description. It is waiting on Apple App Store approval. The app could be approved any day. All App Store metadata must be ready before approval so it can be published immediately.

The pricing model, growth strategy, and launch messaging have been designed and approved in `docs/superpowers/specs/2026-06-07-resumely-growth-pricing-design.md`. The spec is the source of truth for all content decisions — refer to it if you need detail behind any decision.

## Task

Execute all 5 tasks in `docs/superpowers/plans/2026-06-07-resumely-plan-1-aso-launch-assets.md` in order.

The plan is self-contained — it has the exact copy for every file, the character limits to validate, and the git commit commands. Follow it exactly. Do not skip steps.

### What gets created

```
launch-assets/
  aso/
    en-metadata.md       ← English App Store title, subtitle, keywords, promo text, description
    he-metadata.md       ← Hebrew App Store metadata (same structure, Hebrew text)
    screenshot-briefs.md ← Copy/layout brief for 5 screenshot frames
  linkedin/
    content-calendar.md  ← 4-week post calendar with full post copy
    launch-day-posts.md  ← Israeli Facebook groups + community posts + review DM template
```

## Constraints

- Work only in this repo. Do not touch any other project.
- Do not change any code files — this is content only.
- Do not install any packages.
- All character counts must be validated with the Python commands in the plan before committing.
- Commit after each task as specified in the plan — do not batch all tasks into one commit.
- Hebrew metadata must be real Hebrew, not transliterated English. The plan has the exact Hebrew text — use it verbatim.
- All LinkedIn post copy must be complete — no "write something here" placeholders.

## Validation

Before declaring done, verify:

1. All 5 files exist and are non-empty:
```bash
ls -la launch-assets/aso/ launch-assets/linkedin/
```

2. Character counts pass for both English and Hebrew metadata:
```bash
python3 -c "
title = 'Resumely: AI Resume Builder'
subtitle = 'ATS Resume Tailored to Any Job'
keywords = 'resume builder,ATS resume,tailor resume,cover letter,resume optimizer,job search,CV maker'
promo = 'Land more interviews. Paste any job description and get a tailored, ATS-optimised resume in 5 minutes. Free to try.'
print(f'EN Title: {len(title)}/30', 'PASS' if len(title) <= 30 else 'FAIL')
print(f'EN Subtitle: {len(subtitle)}/30', 'PASS' if len(subtitle) <= 30 else 'FAIL')
print(f'EN Keywords: {len(keywords)}/100', 'PASS' if len(keywords) <= 100 else 'FAIL')
print(f'EN Promo: {len(promo)}/170', 'PASS' if len(promo) <= 170 else 'FAIL')
"
```

3. Git log shows 5 separate commits (one per task):
```bash
git log --oneline -6
```

4. No untracked files left in `launch-assets/`:
```bash
git status launch-assets/
```

## Session End Protocol

When done, report:
- Files created (with sizes)
- Commits made (with hashes)
- Character count validation results
- Any content decisions made that deviate from the plan (there should be none)
