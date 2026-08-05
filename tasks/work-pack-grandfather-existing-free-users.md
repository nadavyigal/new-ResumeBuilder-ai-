# Work Pack: Grandfather Existing Free Users Before Monetization

> Open this in the ResumeBuilder web repo (Cursor).
> Ungated — does not require EXD-009 Gate A (CFO price validation) to be open. This is entitlement bookkeeping, not pricing.
> One story. Verify (lint + tests) before calling it done.

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`

**Context:** Red-team + advisor session (2026-07-02) on the Resumely monetization plan flagged the highest-leverage, zero-cost fix: existing users must never hit a surprise paywall mid-session. Plan 3 (StoreKit paywall, `docs/superpowers/plans/2026-06-07-resumely-plan-3-storekit-paywall.md`) is correctly gated behind CFO price validation and D7 activation data — that gate should stay closed while the founder builds traffic. This work pack is independent of that gate: it only needs a cutoff timestamp, not a final price.

**Goal:** Every account created before the paywall ships keeps full free access forever. Only accounts created after the cutoff are subject to any future paywall/credit enforcement. Existing users get a heads-up announcement before anything changes for them (which, per this fix, is nothing).

---

## Phase 1: Add the grandfathering flag (30 min)

- [ ] **Check existing schema for `profiles.credit_balance` / `credit_transactions`** (per `tasks/MEMORY.md` EXD-009 note) — confirm no grandfathering column already exists.
  ```bash
  grep -rn "credit_balance\|is_legacy_free\|grandfathered" src/ supabase/ --include="*.ts" --include="*.sql" -l
  ```

- [ ] **Write a migration** adding a boolean/timestamp to `profiles` (or wherever the canonical user table lives):
  ```sql
  alter table profiles
    add column if not exists legacy_free_access boolean not null default false;
  ```
  Do not apply this migration to production without explicit founder go-ahead per global rule (no migrations without explicit "yes" in the message).

- [ ] **Backfill script (one-time, run at ship time, not now):** set `legacy_free_access = true` for every row where `created_at < <cutoff_timestamp>`. Cutoff = the moment this backfill runs, decided at ship time, not today.

## Phase 2: Entitlement check (30-45 min)

- [ ] Find wherever export/paywall gating will eventually check credits or subscription status (likely near `src/components/paywall/upgrade-modal.tsx` or the export flow).
- [ ] Add a guard: if `profiles.legacy_free_access = true`, skip all paywall/credit checks unconditionally, regardless of which pricing model (flat fee vs. credits) Plan 3 eventually ships with.
- [ ] This guard must not depend on which pricing model is chosen — it's model-agnostic by design, so it doesn't get re-litigated when Gate A opens.

## Phase 3: Comms draft (not code — write, don't send)

- [ ] Draft a one-paragraph in-app + email announcement: "Resumely is introducing pricing for new users. If you signed up before [date], your account keeps full free access — nothing changes for you." Save as `docs/comms/legacy-user-grandfathering-announcement.md`.
- [ ] Do not send. Sending is a separate, explicit founder decision at ship time.

## Verification

- [ ] `npm run lint`
- [ ] Existing test suite passes: `npm test` (or project's test command)
- [ ] Confirm migration is NOT applied to any live database as part of this work pack — schema change only, no deploy.

## Explicitly out of scope

- Final price or credit amount (blocked on Gate A / CFO validation).
- Sending the comms email (separate decision).
- Any StoreKit/IAP code (Plan 3, still gated).
