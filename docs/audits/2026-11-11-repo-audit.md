# Repo audit: Resumely web, 2026-11-11

Branch `claude/2026-11-11-web-repo-audit`, from `main` at 3a32aea.
Baseline on `main`: lint 0 errors / 11 warnings; `tsc --noEmit` **24 errors**; Jest 1,217 passed, 80 skipped; `next build` passes.

## Urgent: credentials committed to this public repo

This repository is public. These were in tracked files on `main`:

| File | What | Since |
|------|------|-------|
| `mcp.json`, `mcp.jason` | Supabase **personal access token** (account-level management access) | 2025-10-08 |
| `full-verification.js` | **service_role** key for production project `brtdyamysfmctrhuankn` (bypasses row-level security: full read/write of every user's data) | 2026-01-28 |
| `scripts/create-supabase-project.js`, `scripts/scripts/create-supabase-project.js` | anon + service_role keys for project `kjzecpnpkmcocykgsxvr` | 2025-10 |
| `scripts/setup-demo-supabase.js`, `scripts/scripts/setup-demo-supabase.js` | anon + service_role keys for project `rsnibhkhsbfhdkqzjako` | 2025-10 |

This branch deletes the files. **Deleting does not revoke anything**: the values stay in git history and in any fork or clone. Only you can revoke them (see the founder action list in the PR).

## Fixed in this branch

| What | Why it was safe |
|------|-----------------|
| Deleted the 7 credential-bearing files above and the whole `scripts/scripts/` folder (an older duplicate of `scripts/`, unreferenced; an agent still edited both copies on 2026-10-20) | Nothing imports or runs them; `package.json`, CI and Vercel use `scripts/` only |
| Pre-commit hook now also blocks Supabase personal access tokens (`sbp_…`) and secret keys (`sb_secret_…`) | The hook's list had neither, which is how `mcp.json` got in |
| `tsc --noEmit`: 24 errors to 0. Typed the `jest.fn()` mocks in 4 test files | CLAUDE.md requires a clean typecheck before done; CI never ran it, so `main` drifted |
| Deleted 24 `src/` modules nothing imports (old dashboard/landing/design components, an unused rate-limit and error-handler middleware, an AI request queue, a score cache, an email helper, the chat-manager barrel + CLI, two utils, `src/types/index.ts` + `design.ts`) | Import resolution across `src/`, `tests/`, `scripts/`, `e2e/`, `evals/` and configs found no importer; checked barrels and dynamic `import()`; typecheck, lint, Jest and build confirm |
| Moved 152 old root reports, SQL snippets and one-off scripts to `docs/archive/2025-root-reports/`; deleted accidental files (`how --name-only HEAD`, `patch.diff`, `build_output.txt`, `build_final_test.txt`, `.pr-body.md`, `.vercel-trigger`, `middleware.ts.disabled`) and the Windows `.bat`/`.ps1` helpers | Repo root went from 193 tracked files to 25. The four GTM docs that `docs/gtm/canonical-90-day-plan.md` cites now point at their new paths |
| Removed 5 unused Next.js starter SVGs from `public/` and moved `public/images/OG_IMAGE_INSTRUCTIONS.md` (served publicly at `/images/…`) into `docs/archive/` | No references |
| `CLAUDE.md`: payments row, business model, env vars and API route list now match the code (it described Stripe and four routes that do not exist). `project-context.md` no longer points at a deleted Stripe route. `AGENTS.md` no longer points at Windows scripts | Docs-only |

## For your review (not changed)

1. **Revoke the leaked credentials** (urgent, founder only). See the PR's action list.
2. **Rewrite git history?** Even after rotation, the keys sit in history of a public repo. Recommend: rotate first (that is what removes the risk); history rewriting is optional and needs a force-push, so it is your call.
3. **AI routes without a rate limit.** CLAUDE.md requires one on every OpenAI route. These call AI code and show no limiter: `/api/v1/expert-workflows/run`, `/api/agent/run`, `/api/ats/rescan`, `/api/v1/design/recommend`, `/api/v1/chat/sessions/[id]/apply`. Recommend: confirm each, then add the same limiter `optimize` uses. Tier 2 change.
4. **`/api/agent/run`**: CI says `src/lib/agent/index.js` "does not exist" and the bench job "has never once run". Recommend: delete the route and bench job, or fix them.
5. **Done 2026-11-13 (founder decision): removed.** Was: **Unused dependencies** (no import anywhere): `@supabase/auth-helpers-nextjs` (deprecated, replaced by `@supabase/ssr`), `date-fns`, `diff-match-patch`, `dompurify` (plus `isomorphic-dompurify` and `sanitize-html` doing the same job), `html2canvas`, `pdfjs-dist`, `resend`. Several `@types/*` are in `dependencies` instead of `devDependencies`. Recommend: remove in one dependency PR (Tier 2).
6. **CI does not run `tsc --noEmit`.** That is why 24 errors reached `main`. Recommend: add one step to `.github/workflows/ci.yml`.
7. **Done 2026-11-13:** `ResumeBuilder_AI_Detailed_Financial_Model.xlsx` moved to the private Builder OS vault (`02-Products/ResumeBuilder/Finance/`) and deleted here. Older versions remain in git history.
8. **Still unwired but kept:** `src/lib/supabase/{auth,client,types}.ts` (only `scripts/setup-supabase.js` checks they exist), `src/lib/design-manager/{index,ats-validator,template-loader}.ts`. Recommend: delete with the legacy setup scripts.
9. **Legacy Supabase bootstrap scripts** in `scripts/` (`setup-supabase*.js`, `test-auth*.js`, `apply-schema.js`, `verify-setup.js`, `test-supabase-connection.js`) date from 2025-10 and target the setup flow, not today's migrations. Recommend: archive.
10. **Stale folders:** `specs/` (spec-kit, last 2026-08), `.specify/`, `.cursor/`, `.superpowers/`, `tasks/work-pack-*`. `tasks/progress.md` is 123 KB. Recommend: archive history, keep the six-field top entry.
11. **97 stale remote branches** (39 unmerged, 58 merged and not deleted). Recommend: delete the merged ones.
12. **`project-context.md` says "Today: free. No paywall"** while iOS 1.6.0 sells export credits. I did not change it because I could not confirm the live paywall state from this repo. Recommend: one-line update by you.
