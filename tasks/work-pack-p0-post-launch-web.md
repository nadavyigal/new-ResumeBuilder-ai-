# Work Pack: Resumely P0 — Post-Launch Web Hygiene

> Open this in the ResumeBuilder web repo.
> Run Tasks 1-2 in Claude Code. Task 3 is manual (App Store Connect).
> **Deadline: immediately — broken link is live now.**

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`
**Context:** App was approved 2026-06-14 as id6776752349. The `ats-checker` SEO page still has a placeholder `id000000000`. Anyone clicking through from the web will hit a dead App Store link.

---

## Phase 1: Fix APP_STORE_URL placeholder (15 min)

- [ ] **Find every occurrence of the placeholder**
  ```bash
  grep -r "id000000000" src/ --include="*.tsx" --include="*.ts" -l
  ```

- [ ] **Fix each file found** — change `id000000000` → `id6776752349`

  Primary file confirmed in scope:
  ```
  src/app/[locale]/ats-checker/page.tsx
  ```

  Also check:
  ```bash
  grep -r "APP_STORE_URL\|apps\.apple\.com.*000000" src/ --include="*.tsx" --include="*.ts" -l
  ```

- [ ] **Verify the final URL resolves correctly** — the correct App Store URL is:
  ```
  https://apps.apple.com/app/resume-ai-cv-builder/id6776752349
  ```

- [ ] **Lint and type-check**
  ```bash
  cd v0 && npm run lint && npm run type-check 2>/dev/null || cd . && npx tsc --noEmit
  ```
  If the project doesn't have a `v0/` subfolder, run from root: `npm run lint`.

- [ ] **Commit and push**
  ```bash
  git add -p
  git commit -m "fix: update APP_STORE_URL placeholder to real Resumely app id (id6776752349)"
  git push origin main
  ```

---

## Phase 2: Verify deployment (5 min)

- [ ] Check Vercel deployment status
  ```bash
  vercel ls --prod 2>/dev/null | head -5
  ```
  Or open Vercel dashboard and confirm the commit deployed without errors.

- [ ] Open `https://resumebuilder-ai.com/ats-checker` (or your prod URL) in a browser
- [ ] Click the App Store button/link — confirm it opens `https://apps.apple.com/app/resume-ai-cv-builder/id6776752349`
- [ ] Repeat for the Hebrew locale if `/he/ats-checker` exists

---

## Phase 3: Paste ASO content into App Store Connect (20 min, manual)

> This is founder-only — requires App Store Connect login. Do not skip — the listing may still have placeholder content from initial submission.

Assets location: `launch-assets/aso/` in this repo (or in the ResumeBuilder iOS repo — check both).

- [ ] Open App Store Connect → My Apps → Resume AI - CV Builder
- [ ] Under **App Store** tab → **App Information**:
  - [ ] Verify app name: `Resume AI - CV Builder`
  - [ ] Paste keywords from `launch-assets/aso/keywords.md` (or equivalent)
  - [ ] Verify subtitle (under 30 chars)
- [ ] Under **App Store** tab → **1.0 Prepare for Submission**:
  - [ ] Paste promotional text from `launch-assets/aso/promotional-text.md`
  - [ ] Paste description from `launch-assets/aso/description.md`
  - [ ] Verify screenshots are uploaded for all required device sizes (6.9" iPhone required)
- [ ] **Save** each section after pasting
- [ ] **Submit for Review** is not needed — the app is already live; ASO content updates go live immediately after Save

---

## Phase 4: Update progress (3 min)

- [ ] Open `tasks/progress.md`
- [ ] Update `Last Validation` with today's date and evidence:
  ```
  Last Validation: APP_STORE_URL fix deployed (2026-06-16). ASO content pasted into App Store Connect.
  ```
- [ ] Commit and push:
  ```bash
  git add tasks/progress.md
  git commit -m "docs: P0 post-launch web hygiene complete (APP_STORE_URL + ASO)"
  git push origin main
  ```

- [ ] Run `./agentic-os refresh` in the Agentic OS repo to sync status

---

**Done when:** The live `/ats-checker` page links to `id6776752349`, ASO content is pasted in App Store Connect, and `tasks/progress.md` is updated and pushed.
