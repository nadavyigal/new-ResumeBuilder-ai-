# 2026-11-13: CI runs the typecheck

Current Phase: Payments v2 configured on; audit follow-ups decided by the founder.
Active Story: add `npx tsc --noEmit` as a gating CI step after lint.
Next Recommended Story: rate limits on the 5 unlimited AI routes (separate Tier 2 PR).
Blockers: none.
Last Validation: 2026-11-13 `npx tsc --noEmit` exits 0 on main; workflow YAML parses.

# 2026-11-13: Rate limits on four AI routes

Current Phase: Payments v2 configured on; audit follow-ups decided by the founder.
Active Story: per-user 20/min cap (RATE_LIMITS.ai, same as refine-section and chat) on expert-workflows/run, agent/run, ats/rescan, design/recommend.
Next Recommended Story: a shared store for the limiter (in-memory today, per server instance).
Blockers: Tier 2; needs founder yes to merge.
Last Validation: 2026-11-13 tsc 0 errors, lint 0 errors, Jest 1265 passed 80 skipped (2 new limiter tests).

# 2026-11-13: Unused dependencies removed; finance model moved private

Current Phase: Payments v2 configured on; audit follow-ups decided by the founder.
Active Story: drop 10 unused packages (8 deps, 2 type packages), move the financial model to the private vault, archive 6 finished work packs.
Next Recommended Story: merge #217 (rate limits) and this PR once CI is green.
Blockers: Tier 2 (dependencies); needs founder yes to merge.
Last Validation: 2026-11-13 tsc 0 errors, lint 0 errors, Jest 1263 passed 80 skipped, next build passes.
Last Updated: 2026-11-13

# 2026-11-12: No "Not specified" placeholders in optimized resumes

Current Phase: Payments v2 configured on; resume output quality fixes from tester feedback (tester call).
Active Story: clear AI stand-ins ("Not specified", "N/A") at optimizer parse, normalizer and expert save; prompts forbid them.
Next Recommended Story: iOS story 1b, ask for missing contact fields before export; then clean the 4 stored rows (needs founder yes).
Blockers: none. Saved rows keep placeholders until cleanup; templates no longer print a stray separator for empty fields.
Last Validation: 2026-11-12, full jest 1263 passed 0 failed; placeholder, expert-apply and template tests pass; eslint clean; tsc 24 unchanged.
Last Updated: 2026-11-12

# 2026-11-11: Repo audit, leaked keys removed, typecheck fixed

Current Phase: Payments v2 configured on; repo hygiene pass on `claude/2026-11-11-web-repo-audit`.
Active Story: remove committed Supabase keys, dead modules, root clutter; make `tsc --noEmit` pass; correct CLAUDE.md.
Next Recommended Story: founder revokes the leaked Supabase token and service_role keys, then audit items 3-6 in `docs/audits/2026-11-11-repo-audit.md`.
Blockers: founder must rotate leaked keys; PR #213 is Tier 2, code-reviewer fixes applied, hosted Codex and founder yes pending.
Last Validation: 2026-11-11 lint 0 errors; tsc 24 to 0; Jest 1217 passed 80 skipped (same as main); next build passes.
Last Updated: 2026-11-11

# 2026-11-11: Vercel Claude plugin enabled per repo, off globally

Current Phase: Payments v2 configured on; #210 billing record merged and live.
Active Story: Claude setup: Vercel plugin now enabled in this repo's .claude/settings.json, disabled at user scope.
Next Recommended Story: find why there are 0 optimizations since 2026-11-05, then run the billing gate test (preflight step C).
Blockers: none. Sessions on branches cut before this merge have no Vercel plugin skills until rebased.
Last Validation: 2026-11-11, claude plugin list shows vercel enabled on this branch, disabled in Agentic OS and iOS repos.
Last Updated: 2026-11-11

# 2026-11-11: Pin the E2E job to ubuntu-24.04 (#211)

Current Phase: Payments v2 configured on; #210 billing record merged (aaaa8f7) and live.
Active Story: CI fix: Activation path E2E fails on ubuntu-latest (26.04), Playwright has no Chromium there.
Next Recommended Story: find why there are 0 optimizations since 2026-11-05, then run the billing gate test (preflight step C).
Blockers: none for this fix. Undo the pin once Playwright supports Ubuntu 26.04.
Last Validation: 2026-11-11, run 42966159216 failed at Playwright install on ubuntu26.04; PR #211 checks pending.
Last Updated: 2026-11-11

# 2026-11-11: Billing state read back; preflight record corrected (#210)

Current Phase: Payments v2 configured on (deploy 83vqo92my, 7a36835); gate not yet exercised by any export; 0 real purchases.
Active Story: PR #210 record fixes: fresh-lock gate test, per-product first-sale check, production state, accepted risks.
Next Recommended Story: find why there are 0 optimizations since 2026-11-05 (no traffic, or broken flow), then run step C.
Blockers: step C needs an account outside the test list; Claude may not create production accounts. Server notification URL unverified.
Last Validation: 2026-11-11 read-only: Vercel deploy and env metadata; Supabase counts: 0 unlocks and 0 Production rows since switch.
Last Updated: 2026-11-11

# 2026-11-08: Billing is ON for Resumely iOS (EXD-041)

Status: `EXPORT_CREDITS_ENABLED=true` set in Vercel production (`new-resume-builder-ai`) on the founder's yes, 2026-11-08. Production redeployed: `new-resume-builder-83vqo92my`, READY 18:42 UTC, commit `7a36835`, aliased to www.resumelybuilderai.com. Value read back as `true`. Docs in PR nadavyigal/new-ResumeBuilder-ai-#210; decision EXD-041 in Agentic-OS PR #141.
Current Phase: Payments v2 live. iOS exports past the 3 free ones need a pack (5 or 14) or Pro. Web stays free.
Active Story: watch the first non-gated iOS export and the first real sale.
Last Completed Story: billing switch preflight (`docs/qa/2026-11-08-billing-switch-preflight.md`).
Next Recommended Story: Claude reads `export_unlocks` for a non-gated account with `source` `welcome_grant` or `credit` after 18:42 UTC (proves the gate applies beyond the test list), and the first `credit_transactions` row with `environment = 'Production'`. Day 1 and day 7: `export_blocked`, `paywall_shown`, `purchase_completed`, `iap_verify_failed` in PostHog (spec 11 step 8).
Blockers: none for selling. Not verified: a non-gated account hitting the gate (no way to sign in as one; Claude may not create production accounts). App Store server notification URL (refunds) not checked. Founder only: עוסק פטור approval, accountant, Small Business Program.
Last Validation: 2026-11-08 env value `true` (production target); deploy READY; `POST /api/v1/exports/unlock` without auth answers 401 on the new deploy. App Store Connect: Paid Apps agreement, bank, tax Active; packs Approved. Supabase: 7/7 migrations; 0 Production purchases before the switch.
Kill switch: delete `EXPORT_CREDITS_ENABLED` in Vercel production and redeploy.
Last Updated: 2026-11-08

# 2026-11-05: Password reset works again (PR #208)

Status: branch `claude/web-update-password-page`, PR nadavyigal/new-ResumeBuilder-ai-#208 open, not merged, not deployed.
Current Phase: Payments v2; Resumely iOS 1.6.0 is in App Review.
Active Story: the reset email linked to `/auth/update-password`, which returned 404, so no user could reset a password. New page sets the password with `supabase.auth.updateUser` from a recovery session (PKCE code, `token_hash`, or hash tokens), then signs out. Middleware lets a signed-in browser open `/auth/update-password` and `/auth/confirm`. `/auth/confirm` records `signup_completed` only for sign-up and email confirmations. `SMTP-PASSWORD-FIX.md` (plain-text Resend key) deleted.
Last Completed Story: #207 Stripe leftovers merged and live.
Next Recommended Story: founder yes to switch the Supabase "Reset password" template from the default `{{ .ConfirmationURL }}` (PKCE code, same browser only) to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`; merge and deploy #208 on his yes; test one real reset end to end.
Blockers: Resend API key must be rotated by the founder (it is in git history and 10 more tracked docs); founder decision on redacting those docs. Codex review unavailable (usage limit).
Last Validation: 2026-11-05 jest 119 suites passed, 6 skipped, 0 failed (1217 tests); `npm run lint` 0 errors, 11 old warnings; `npm run build` passes with the route; `tsc --noEmit` 24 old errors; local `next start` renders EN and HE pages.
Last Updated: 2026-11-05

# 2026-11-05: Remove the leftover Stripe code (WP-79 S5 follow-up)

Status: branch `claude/2026-11-05-remove-stripe-leftovers`, PR open, not merged. Merging deploys production; no user sees a change (the gate was closed).
Current Phase: Payments v2, Resumely iOS 1.6.0 submission prep.
Active Story: Resumely bills through Apple, so the dead Stripe path goes. Deleted `/api/upgrade` (Stripe checkout, returned 403 behind the closed gate), the unused `UpgradeModal`, its route test, the two optional Stripe keys in `src/lib/env.ts`, and the `securePayment` string ("Secure checkout via Stripe") in 4 message files. `ExpertModesPanel` lost its dead upgrade call and always shows the disabled "coming soon" button it already showed. The FR-023/024 block in `tests/contract/test_user_management.spec.ts` called the deleted route and is gone. `tests/security-fixes.test.ts` section 5 now fails if any file under `src` mentions Stripe.
Last Completed Story: Terms and Privacy name Apple billing (#206, merged `fc6e276`, live).
Next Recommended Story: founder merges; then iOS 1.6.0 submission (WP-79 S6 to S8).
Blockers: none. Founder yes needed to merge (deploys production).
Last Validation: 2026-11-05 jest 116 suites passed, 6 skipped, 0 failed (1199 tests); `npm run lint` 0 errors, 11 warnings; `npm run build` passes; `tsc --noEmit` 24 errors, all in the same 4 test files as main. Guard test checked both ways: it fails when a `stripe` comment is added to `src/lib/env.ts`.
Last Updated: 2026-11-05

# 2026-11-05: Terms and Privacy name Apple billing (WP-79 S5)

Status: branch `claude/terms-apple-billing-2f7713`, PR open, not merged, not deployed. Merging deploys the live Terms.
Current Phase: Payments v2, Resumely iOS 1.6.0 submission prep.
Active Story: `/terms` section 4 rewritten from the dead Stripe $9/month Premium plan to Apple In-App Purchase: free Match Score, 3 free PDF downloads per account, 5 for $3.99, 14 for $7.99, Pro $9.99/month (fair use 40 per period), Apple renewals, cancellation in iOS Settings, refunds at reportaproblem.apple.com, Apple EULA link. `/privacy` payment line and provider list swap Stripe for Apple. EN and HE. Guard test `tests/contracts/legal-pages-billing-copy.test.ts`.
Last Completed Story: Growth audit gates (#205).
Next Recommended Story: founder reads the PR screenshots and merges; then iOS 1.6.0 submission.
Blockers: none. Founder yes needed to merge (deploys production).
Last Validation: 2026-11-05 jest 117 suites passed, 6 skipped, 0 failed (1200 tests); `npm run lint` 0 errors; `npm run build` passes; `tsc --noEmit` 24 errors, all in 4 test files this branch does not touch (same as 2026-10-31). `/terms` and `/privacy` checked in Chrome in EN and HE (screenshots in `audit/terms-apple-billing/`).
Last Updated: 2026-11-05

# 2026-10-31: Growth audit gates: store link, Hebrew copy, replay masking

Status: branch `fix/2026-10-31-growth-gates`, PR open, not merged, not deployed.
Current Phase: Market play. These three fixes gate invitations and the capped $150 paid test (vault `02-Products/ResumeBuilder/2026-10-31-growth-pack/`).
Active Story: Store link reads `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` and builds Apple's `pt`, `ct`, `mt` link, with `ct` cut to Apple's 30-character limit. `/he` copy fixed in both Hebrew message files, slogan added under the heading. `data-private` added to the result root, the selected file name and the form error.
Last Completed Story: Pricing v2 server (#204).
Next Recommended Story: Founder sets the provider token in Vercel, then the paid test can record campaigns.
Blockers: the provider token. Until it is set, the store link is the old one and Apple records no campaign. It comes from a campaign link generated in App Store Connect.
Last Validation: 2026-10-31 jest 1186 passed, 84 skipped, 0 failed; eslint on changed files passed; `check:i18n` passed; `/he` checked in a browser at 375 and 1024 wide with a fake token. `tsc --noEmit` has 24 errors, all in 4 test files this branch does not touch. No real session recording was made.
Last Updated: 2026-10-31

# 2026-10-30: Pricing v2 server, S5 grant source (draft PR #204)

Status: branch `claude/pricing-v2-server`, draft PR nadavyigal/new-ResumeBuilder-ai-#204. Not merged. Migration applied to production 2026-10-30 (founder yes), recorded as 20261030094500; file renamed to match. New accounts now start at 0 and every real account gets the 3 free exports on its first credit read or export.
Current Phase: Payments v2 (iOS plan `plans/resumely-pricing-v2.md`).
Active Story: S5 analytics. `unlock_export` reports `source: welcome_grant` for an export paid by the 3 free exports and keeps it on re-download, so the app can send `export_completed` with `grant` or `pack`. Codex on e9ff4ca: P2 (a retried EXPIRED or GRACE_PERIOD_EXPIRED sent subscription_cancelled again), fixed in a904f2e with `claim_subscription_notification` (service_role only). Codex on 6f7e892: no major issues. CodeRabbit: 2 minor (unknown subscription products were recorded by notifications; lesson wording), fixed in fbfd001.
Last Completed Story: S1 server pricing v2 (Codex clean at abc36d4 before this change).
Next Recommended Story: S6 QA and Sandbox on the founder's phone.
Blockers: none for the migration. Next launch step is merging #204, then TestFlight 1.6.0.
Last Validation: 2026-10-30 on production after apply: recorded statements match the file by md5 (963d4606...), default 0, source check has 4 values, 4 new tables with RLS and no client writes, 13 functions service_role only, real calls as anon and authenticated both 42501, rolled-back welcome grant 9 to 12 then already_granted, 0 rows left behind. Before apply: 2 apple_iap rows, 1 user, 0 Production, so no real buyer is affected. Security advisors: the only new warnings are 2 constant functions without a search_path (they read nothing) and RLS with no policies on subscription_notification_events (intended).
Last Updated: 2026-10-30

## 2026-11-02 — Web #205 review repairs (commit/push and Preview approved)

Existing `growth-gates` worktree/branch retained at `cc48991`; current reviews and
Steward read. Added stable bounded long-ID tokens and a complete-registry
collision preflight; settled the long-ID fallback as an intentional migration.
Corrected fresh-build/deploy/rollback guidance, removed this PR's env template
addition and aligned Hebrew base/override/assertions. Actual local recorder tests
found filename/input-attribute leaks; blocked sensitive controls and verified
fictional error/result/URL captures. Production provider, inventory and hosted
playback remain unverified. Founder then accepted the fixes and approved commit,
push and automatic Preview; production changes remain on hold. No merge or
production configuration/deployment is authorized. See `docs/gtm/growth-loop/2026-11-02-pr205-handoff.md` for checks, limitations and
the exact commit/push, configuration and deployment approval sequence.

Older entries: [tasks/archive/progress-to-2026-10-29.md](archive/progress-to-2026-10-29.md).
