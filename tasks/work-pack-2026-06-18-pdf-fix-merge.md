# Work Pack: PDF Fix Merge to Main — 2026-06-18

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute task-by-task.

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`

**Goal:** Merge `fix/pdf-parser-unpdf` into main, confirm the Vercel deployment is healthy, and smoke test that ATS PDF parsing no longer 500s in production.

**Context:**
- Current branch: `fix/pdf-parser-unpdf`. This branch is in sync with `origin/fix/pdf-parser-unpdf`.
- The branch has 1 commit ahead of `origin/main`: `497a6f8 fix(ats): switch PDF parsing to unpdf — fixes the Vercel 500 for real`.
- This branch parks the render-preview rollout — that stays parked until Resumely iOS device smoke confirms the backend is clean.
- The `/api/v1/resumes` Route is live as of 2026-06-16 (commit `d471a3a`).

---

## Task 1: Verify branch is up to date and tests pass (10 min)

- [ ] Confirm current branch and its diff from main:
  ```bash
  cd "/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-"
  git status --short --branch
  git log --oneline origin/main..HEAD
  ```
  Expected: 1 commit on this branch beyond main.

- [ ] Run the test suite on the branch:
  ```bash
  cd v0 2>/dev/null || true
  npm run test 2>&1 | tail -20
  ```
  Expected: all tests pass. If failures, investigate before opening PR.

- [ ] Run type check:
  ```bash
  npm run type-check 2>&1 | tail -10
  ```
  Expected: no errors.

---

## Task 2: Open a PR for fix/pdf-parser-unpdf -> main (5 min)

- [ ] Create the PR:
  ```bash
  gh pr create \
    --base main \
    --head fix/pdf-parser-unpdf \
    --title "fix(ats): switch PDF parsing to unpdf — fixes Vercel 500 on free ATS check" \
    --body "$(cat <<'EOF'
## Summary
- Switches ATS PDF parsing from `pdfjs` to `unpdf` to fix the Vercel 500 that affected all free-tier ATS check users.
- Prior fixes (webpackIgnore, esm-require) are superseded by this approach.
- Render-preview rollout remains parked — no change to that feature flag.

## Test plan
- [ ] Confirm all existing tests pass locally.
- [ ] After merge, verify Vercel deployment builds without error.
- [ ] Smoke test: upload a PDF to the free ATS check in production — confirm no 500.
- [ ] Check Vercel logs for any new parse errors.
EOF
)"
  ```

- [ ] Copy the PR URL from the output.

---

## Task 3: Merge the PR (5 min)

- [ ] After reviewing the PR diff:
  ```bash
  gh pr merge fix/pdf-parser-unpdf --squash --delete-branch
  ```

- [ ] Sync main locally:
  ```bash
  git checkout main
  git pull origin main
  ```

---

## Task 4: Verify Vercel deployment (10 min)

- [ ] Check the deployment status:
  ```bash
  gh run list --limit 5 2>/dev/null || echo "Check Vercel dashboard directly"
  ```
  Or open the Vercel project dashboard and confirm the latest deployment for `main` is green.

- [ ] Confirm deployment URL is production (not preview).

---

## Task 5: Smoke test ATS PDF parsing in production (10 min)

- [ ] Open the live app in a browser (use the production URL, not a preview).

- [ ] Navigate to the free ATS check feature.

- [ ] Upload a real PDF resume file (any standard PDF — can be a sample file).

- [ ] Confirm:
  - No 500 error or spinner that never resolves
  - ATS score or analysis returns within ~10 seconds
  - No error toast or error boundary shown

- [ ] If the smoke passes, update progress:
  ```bash
  printf "\n## 2026-06-18 — ATS PDF fix merged + smoke passed\nfix/pdf-parser-unpdf merged to main. unpdf resolves the Vercel 500. Render-preview remains parked.\n" >> tasks/progress.md
  git add tasks/progress.md
  git commit -m "docs: record ATS PDF fix merge and smoke result 2026-06-18"
  git push origin main
  ```

- [ ] If the smoke fails, open `tasks/ERRORS.md` and log the exact failure before closing.

---

## Done criteria
- [ ] All tests pass on branch
- [ ] PR open and merged to main
- [ ] Vercel deployment green
- [ ] Production PDF ATS smoke test passes
- [ ] progress.md updated and pushed
