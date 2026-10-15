# Resumely StoreKit export credits: engineering spec

- **Written:** 2026-10-15, market play Track 2, story P3a (`docs/plans/2026-10-14-market-play-implementation.md`).
- **Decision it implements:** EXD-035 (Agentic OS): packs of 1 / 5 / 10 tailored exports at $3.99 / $12.99 / $19.99, credits never expire, no subscription at launch.
- **Status:** F1 to F6 decided by the founder on 2026-10-15 (section 2). The whole spec waits for founder approval after the independent review. Approving it closes StoreKit gate condition 4 only.
- **Replaces:** the skeleton tasks in `docs/superpowers/plans/2026-06-07-resumely-plan-3-storekit-paywall.md` (its four-tier products, the `storekit-verify` edge function and the `user_credits` / `iap_purchases` tables). Pricing context stays in `docs/superpowers/specs/2026-06-07-resumely-growth-pricing-design.md`, except its Tier 4.

## 0. The gate (unchanged)

Nothing in this spec is built until all four conditions in
`docs/superpowers/plans/2026-06-07-resumely-plan-3-storekit-paywall.md:16-22` hold **and** the
founder says yes in that message. A feature flag does not satisfy any of them.

| # | Condition | State on 2026-10-15 |
|---|---|---|
| 1 | Prices validated against AI cost | Met: R1 plus EXD-035. |
| 2 | Apple's rate confirmed (15% or 30%) | Open. Founder checks Small Business Program enrollment. |
| 3 | First-cohort D7 readable (EXD-009, traffic gate EXD-029) | Open. About 3 arrivals a week against 50. |
| 4 | This spec written and approved | Written. Waiting for founder approval. |

Proposed exception, for the founder to approve separately: section 13, "Fail closed now". It removes
a live way to mint credits and creates no product, price, paywall or export decrement.

## 1. What this spec covers, and what it does not

Covers: what one export credit buys, how an export spends it (atomic, idempotent, no bypass), the
one free export, purchase verification on the server, refunds, restore, the paywall sheet at
export, PostHog events, the migration, the flags and the rollout, and the tests that prove it.

Does not cover: a web checkout (Stripe stays closed, 2026-07-03 Gate A record in Agentic OS
`DECISIONS.md`), subscriptions, price experiments, App Store Connect copy and screenshots, and the
paid home of features the June spec put in "Unlimited only" (see decision F5).

## 2. Founder decisions (decided 2026-10-15)

The founder answered all six on 2026-10-15, each as recommended: "f1 yes, f2 yes, f3 yes, f4 yes,
f5 yes f6 yes". One founder step stays open: check App Store Connect for the old `credits_*`
product IDs (F4).

| # | Question | Decided 2026-10-15 | Why |
|---|---|---|---|
| F1 | Do web exports need a credit at launch? | **No.** Gate iOS only. Web exports stay free until a web checkout exists. | A web user at zero credits would hit a wall with nothing to buy behind it. That is the exact failure measured on 2026-08-12 (`src/lib/premium-access.ts:3-11`). Cost: an iOS user can export the same résumé from the web for free. Measure it with `export_unlocked` by platform (section 10). |
| F2 | What happens to the 3 credits every account holds today? | **Keep them** as export credits. New accounts start with 1 (the free export). | 80 external accounts hold 3 each (read 2026-10-15). At most 240 exports, about $5 of AI cost at R1 prices. Zeroing them takes something users were given. |
| F3 | May the build add `@apple/app-store-server-library` (npm)? | **Yes.** Installed only when P3b starts, not before. | Apple's own library verifies the signed transaction against Apple's root certificate and checks bundle and environment. Writing that chain check by hand is the riskiest code in this feature. Global rule: no new dependency without the founder's yes. |
| F4 | Product IDs | **New IDs:** `resumely.exports.1`, `resumely.exports.5`, `resumely.exports.10`. | A product ID can never be reused once created in App Store Connect. The iOS catalog today names `credits_basic` / `credits_saver` / `credits_super` at 100 / 500 / 2,500 units. **Open founder step:** check App Store Connect for those three IDs; if any exist, they are never sold and never mapped. |
| F5 | Expert workflows with no Unlimited tier | **Leave them ungated.** `MONETIZATION_ENABLED` stays off; export credits use their own flag. | EXD-035 removed their paid home. Gating them again needs its own decision row. |
| F6 | Accept Sandbox transactions on the production server? | **Yes, flagged.** Grant them, store `environment = 'Sandbox'` on the ledger row, and exclude them from revenue reads. | App Review buys in Sandbox against the production server. Rejecting Sandbox there fails review. Only App Review, TestFlight testers and Sandbox accounts the founder creates can make Sandbox purchases for this app. |

## 3. What is true today (verified 2026-10-15)

| Area | Fact | Where |
|---|---|---|
| Credit store | One ledger: `profiles.credit_balance` plus `credit_transactions`. `user_credits` and `iap_purchases` were never applied to production. | `supabase/migrations/20260503000000_credit_ledger.sql`; live read of `brtdyamysfmctrhuankn` |
| Starting balance | Column default 3; `consume_credit` and `grant_apple_credits` also hardcode 3 when they create a profile. | `20260503000000_credit_ledger.sql:2`, `:63-64`, `:111-112` |
| Grant idempotency | `credit_transactions.apple_transaction_id` is unique; `grant_apple_credits` inserts with `on conflict do nothing` and grants only if the row was new. | `20260503000000_credit_ledger.sql:10`, `:115-138` |
| Function access | `consume_credit` and `grant_apple_credits` run only as `service_role` (R1). Client writes to `profiles` and `credit_transactions` are revoked. | `20260922000000_revoke_client_definer_exec.sql`; `20260811093000_lock_down_profiles_and_credit_ledger_writes.sql` |
| Verification | `verifyAppleTransaction` treats any 2xx from a configured URL as verified and never reads the body. | `src/lib/iap.ts:11-40` |
| Verify route | Amount comes from the client-sent `productId`. When `APPLE_VERIFY_TRANSACTIONS_URL` is unset the check is skipped and credits are granted anyway (`verification: 'not_configured'`). | `src/app/api/v1/iap/verify/route.ts:27`, `:33`, `:66` |
| Pack units | `credits_basic` 100, `credits_saver` 500, `credits_super` 2,500. | `src/lib/iap.ts:1-5` |
| Apple grants so far | 0 ledger rows with an Apple transaction. | live read 2026-10-15 |
| Export route | `/api/download/[id]` checks the user and row ownership, renders PDF or DOCX, no credit check. | `src/app/api/download/[id]/route.ts:26`, `:34-39`, `:178` |
| iOS StoreKit | `StoreKitManager` finishes the transaction before the server has granted anything, and sends only the transaction ID. Parked behind `BackendConfig.isMonetizationEnabled = false` (a compile-time constant). | iOS `Core/Payments/StoreKitManager.swift:45`; `Core/Payments/ReceiptVerifier.swift`; `Core/API/BackendConfig.swift:27` |

### Every way an export leaves the product today

| # | Path | Runs on | Calls the server per export? |
|---|---|---|---|
| E1 | `GET /api/download/[id]?fmt=pdf\|docx` (web optimization page, history row, iOS) | server | yes |
| E2 | `POST /api/apply-job` returns `resumePdfBase64` | server | yes. No caller found in web `src/` or iOS on 2026-10-15. |
| E3 | Web "Print" (`window.print()`) | browser | no (`src/app/[locale]/dashboard/optimizations/[id]/page.tsx:634`) |
| E4 | Web "Copy text" (`navigator.clipboard`) | browser | no (`page.tsx:658`) |
| E5 | iOS styled PDF from render-preview HTML (`HTMLPDFExporter`) | device | fetches `/api/v1/design/render-preview`, which also feeds the on-screen preview (`Core/Export/ResumeExportAction.swift:34`) |
| E6 | iOS local PDF from loaded sections (`LocalResumePDFExporter`): guests, and any non-4xx server failure | device | no (`ViewModels/OptimizedResumeViewModel.swift:404-415`, `:461-480`) |

E3 to E6 run on content the user already sees on screen. The server cannot stop a user who copies
text off the screen, and this spec does not try: the June spec's rule is "see everything, pay to
download". What the server **can** guarantee is that no server-rendered file (E1, E2) leaves
without an unlock, and that every client export button asks the server first.

## 4. Products and pack mapping

| Product ID (F4) | Type | Price | Credits |
|---|---|---|---|
| `resumely.exports.1` | Consumable | $3.99 | 1 |
| `resumely.exports.5` | Consumable | $12.99 | 5 |
| `resumely.exports.10` | Consumable | $19.99 | 10 |

- The server mapping replaces `CREDIT_PACKS` in `src/lib/iap.ts:1-5`. Unknown IDs, including the
  three old ones, map to nothing and are rejected.
- Credits granted = mapping × the transaction's `quantity` (a consumable can be bought with
  quantity above 1).
- Prices live in App Store Connect only. The app shows `product.displayPrice`, never a typed price.
- Credits never expire: no expiry column, no job that removes credits.

## 5. Data model (one migration, written in P3b, applied only at the founder's yes)

Keep the existing ledger. Do not apply `20260607000000_user_credits_iap_purchases.sql`; P3b deletes
it from the repo so there is one credit store, not two.

```sql
-- 1. New accounts start with the free export.
alter table public.profiles alter column credit_balance set default 1;
-- consume_credit and grant_apple_credits: change the hardcoded 3 on profile creation to 1.
-- Existing balances are not touched (F2).

-- 2. Ledger columns for purchases and refunds.
alter table public.credit_transactions
  add column if not exists optimization_id uuid references public.optimizations(id) on delete set null,
  add column if not exists product_id text,
  add column if not exists environment text check (environment in ('Production', 'Sandbox')),
  add column if not exists apple_notification_uuid text unique,
  -- refund rows point at the grant here; apple_transaction_id stays unique to the grant row.
  add column if not exists related_apple_transaction_id text;

-- 3. One row per exported optimization. The unique key is the idempotency key.
create table public.export_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  optimization_id uuid not null references public.optimizations(id) on delete cascade,
  source text not null check (source in ('credit', 'ungated')),
  created_at timestamptz not null default now(),
  primary key (user_id, optimization_id)
);
alter table public.export_unlocks enable row level security;
create policy "Users read own export unlocks"
  on public.export_unlocks for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.export_unlocks from anon, authenticated;
```

`optimizations.id` and `profiles.user_id` are `uuid` in production (read 2026-10-15), so the foreign keys above match.

## 6. Export consumption

### 6.1 Unit

One credit unlocks **one optimization** for export, forever: every format, every re-download,
every retry. Exporting the same tailored résumé as PDF and then DOCX costs one credit, not two.
This is what makes the spend idempotent without request IDs.

### 6.2 The function

`unlock_export(p_user_id uuid, p_optimization_id uuid, p_charge boolean) returns jsonb`, `security definer`,
`set search_path = public`, executable by `service_role` only (revoke from `public`, `anon`,
`authenticated` in the same migration, the R1 pattern). One call is one transaction:

1. `select ... from optimizations where id = p_optimization_id and user_id = p_user_id`. None: return `{status: 'not_found'}`.
1b. If `p_charge` is false (section 6.5, ungated): insert `export_unlocks (source 'ungated')` on conflict do nothing, return `{status: 'ungated'}`. Nothing is spent.
2. Insert the profile if missing (balance 1), then `select credit_balance from profiles where user_id = p_user_id for update`. The row lock serializes every unlock and grant for this user.
3. If `export_unlocks` already has `(p_user_id, p_optimization_id)`: return `{status: 'already_unlocked', balance}`. No spend.
4. If `credit_balance < 1`: return `{status: 'insufficient', balance: 0}`. No row written.
5. Decrement `credit_balance` by 1, insert `export_unlocks (source 'credit')`, insert a ledger row (`delta -1`, `reason 'export_unlock'`, `source 'usage'`, `optimization_id`). Return `{status: 'unlocked', balance}`.

If rendering fails after step 5, the user has paid for that optimization and the retry is free (step 3).

Concurrency: two requests for the same optimization serialize on the profile lock; the second sees
step 3 and spends nothing. Two requests for different optimizations with a balance of 1 serialize
too; the second gets `insufficient`.

### 6.3 The one free export

The free export is the starting credit of 1 (section 5). No special case in the function.
- Anonymous sessions (`user.is_anonymous`, `src/lib/rate-limiting/anonymous-optimize-limit.ts:40`)
  cannot unlock. The route answers 401 `account_required`, which is where Track 1 (G1c) asks for the
  account: at the first tailored export.
- A new account per free export is possible. Accepted: it costs about $0.03 of AI per attempt
  (R1) and needs a new email each time.
- Analytics tells free from paid by whether the user has any `apple_iap` ledger row (section 10).

### 6.4 Where it is called

| Path | Change |
|---|---|
| New `POST /api/v1/exports/unlock {optimizationId}` | Resolves the user with `getUser()`, rejects anonymous, calls `unlock_export` with `p_charge` per 6.5. 200 `{status, balance}`; 402 `{error: 'export_credits_required', balance: 0}`; 404 for `not_found`. Rate limit `RATE_LIMITS.export`. |
| E1 `/api/download/[id]` | Call `unlock_export` (with `p_charge` per 6.5) after the ownership read (`route.ts:34-39`) and **before** any rendering. `insufficient` returns 402 `export_credits_required` with no file. Calling the route directly therefore spends or refuses exactly like the button. |
| E2 `/api/apply-job` | Same call as E1. P3b first confirms it has no caller; if none, delete the route instead of gating it. |
| E3, E4 web print and copy | Web is ungated at launch (F1). If F1 changes, both buttons call the unlock endpoint first. |
| E5, E6 iOS exporters | `ResumeExportAction` calls the unlock endpoint first and runs a local exporter only on 200. The E6 fallback in `downloadPDFWithLocalFallback` already rethrows `paymentRequired` (`OptimizedResumeViewModel.swift:466`), so a 402 never falls through to a free local copy. Guests (no token) cannot export when gated; they are asked to create the account. |

### 6.5 When the gate applies

`EXPORT_CREDITS_ENABLED=true` on the server **and** the request comes from the iOS app (F1). The
iOS app sends `X-Resumely-Client: ios` (it already sends a bearer token). Because web is ungated,
a client that lies about the header gains nothing it could not get from the web. If F1 changes,
the platform check is removed and every request is gated.

Off (the default), and on for web while F1 holds: `unlock_export` runs with `p_charge = false`.
Nothing is spent, `/api/v1/exports/unlock` answers 200 `{status: 'ungated'}`, and an `ungated`
row is recorded. So a résumé exported before the flag turns on stays free to re-download after it.
Exports made before P3b deploys are not stored anywhere (R1: exports live only in PostHog), so they
cannot be backfilled; at today's volume (4 exports in 30 days) that is accepted.

## 7. Purchase verification

### 7.1 Flow

1. The app buys with `product.purchase(options: [.appAccountToken(<Supabase user id as UUID>)])`.
2. On `.verified(transaction)` the app sends `POST /api/v1/iap/verify` with
   `{ signedTransaction: <jwsRepresentation>, productId }` and the bearer token.
   It does **not** call `transaction.finish()` yet (today it does, `StoreKitManager.swift:45`).
3. The server verifies and grants (7.2). On 200 the app calls `transaction.finish()` and refreshes
   the balance. On any failure it leaves the transaction unfinished.
4. On every launch and on `Transaction.updates`, the app re-sends every unfinished verified
   transaction. Granting is idempotent, so a repeat is safe. This is the recovery path for a
   crash or a network failure between payment and grant.

### 7.2 Server checks, all required, in this order

| # | Check | Failure |
|---|---|---|
| 1 | Config present: bundle ID, App Apple ID, allowed environments, Apple root certificates | 503 `iap_verification_unavailable`. **Never grant.** This replaces the skip at `route.ts:33`. |
| 2 | User resolved with `getUser()`, not anonymous | 401 |
| 3 | `signedTransaction` passes `SignedDataVerifier` (F3): signature chain to Apple Root CA G3, `bundleId`, `environment` | 400 `invalid_transaction` |
| 4 | `environment` is in `APPLE_IAP_ALLOWED_ENVIRONMENTS` (F6) | 400 `environment_not_allowed` |
| 5 | `type` is `Consumable`; `productId` is in the section 4 mapping; it equals the `productId` the client sent | 400 `unknown_product` or `product_mismatch` |
| 6 | `appAccountToken` equals the caller's user ID | 403 `account_mismatch` |
| 7 | `revocationDate` is absent | 409 `transaction_revoked` |
| 8 | Grant: `grant_apple_credits(user, credits × quantity, ..., transactionId)` extended to write `product_id` and `environment` | 500 `failed_to_grant_credits` |

Response: `{ success: true, status: 'granted' | 'already_granted', creditsGranted, balance }`.
`already_granted` when the transaction ID is already on the ledger **for this user**. If it is on
the ledger for another user, answer 409 `transaction_owned_by_another_account` (today it returns
success with nothing granted). The amount always comes from the verified transaction, never from
the request body.

### 7.3 Configuration (names only, values live in Vercel)

`APPLE_IAP_BUNDLE_ID` (today `Resumebuilder-IOS.ResumeBuilder-IOS-APP`), `APPLE_IAP_APP_APPLE_ID`,
`APPLE_IAP_ALLOWED_ENVIRONMENTS` (`Production,Sandbox` in production per F6, `Sandbox` in preview),
and the Apple root certificates bundled in the repo (public files, not secrets). The current
`APPLE_VERIFY_TRANSACTIONS_URL` and `APPLE_VERIFY_BEARER_TOKEN` are removed.

## 8. Refunds

- Endpoint `POST /api/v1/iap/notifications` receives App Store Server Notifications V2. Its URL is
  set in App Store Connect (founder step). Every payload is verified with the same
  `SignedDataVerifier`; unverified payloads get 400 and change nothing.
- Idempotency: the notification's `notificationUUID` is stored in
  `credit_transactions.apple_notification_uuid` (unique). A repeat changes nothing and returns 200.
- `REFUND`: find the grant row by transaction ID. Deduct `min(credits granted, current balance)`
  with a ledger row (`reason 'iap_refund'`, negative delta, `related_apple_transaction_id` set,
  `apple_transaction_id` null). The balance never goes below 0.
  Exports already unlocked stay unlocked.
- `REFUND_REVERSED`: re-grant the amount that the refund deducted.
- `CONSUMPTION_REQUEST`: logged only in v1. Answering it with consumption data is a later decision.
- Any other type: logged, 200, no change.

## 9. Restore

Consumables are not restorable through StoreKit, and the app does not need a "Restore purchases"
button for them. Credits live on the account, so "restore" means signing in to the same account
on the new device; the balance comes from `GET /api/v1/credits`. The paywall sheet says this in one
line. Unfinished transactions are recovered by 7.1 step 4, not by a restore button.

## 10. Paywall sheet and analytics

### 10.1 iOS sheet at export

- Shown when the unlock endpoint or `/api/download` returns 402 `export_credits_required`.
  Never shown before the user taps export, never on launch, never as a banner. No "Premium"
  wording anywhere (EXD-018).
- Three rows with `product.displayPrice`, ordered 1 / 5 / 10. One line on what a credit buys:
  "One credit exports one tailored résumé, in any format, as often as you need." One line on
  "Credits never expire." One line on restore (section 9). A close button.
- After a successful grant the sheet closes and the export the user tapped runs without a second tap.
- The parked `Payments/` drafts and `Features/Profile/PaywallView.swift` are replaced, not extended:
  they are built for the four-tier shape.
- Hebrew strings ship in the same build (the iOS app has full Hebrew coverage).

### 10.2 Web at launch

Ungated (F1). No price, no paywall, no purchase link on the web.

### 10.3 PostHog events (project 270848)

| Event | Fired by | Properties |
|---|---|---|
| `export_unlocked` | server, unlock function result | `optimization_id`, `status` (`unlocked`, `already_unlocked`, `ungated`), `paid_user` (has any `apple_iap` row), `balance_after`, `platform` |
| `export_blocked` | server, 402 | `optimization_id`, `platform` |
| `paywall_shown` / `paywall_dismissed` | iOS | `optimization_id`, `balance` |
| `purchase_started` / `purchase_cancelled` / `purchase_pending` | iOS | `product_id` |
| `purchase_completed` | iOS, after the server grant | `product_id`, `price`, `currency` (from StoreKit), `credits_granted` |
| `iap_verified` | server | `product_id`, `credits_granted`, `environment`, `status` (`granted`, `already_granted`) |
| `iap_verify_failed` | server | `reason` (the error code in 7.2), `product_id` when known |
| `iap_refund_processed` | server | `product_id`, `credits_deducted`, `environment` |

No email, name or résumé text in any property. Existing `export_started`, `export_success` and
`export_failed` stay as they are.

## 11. Rollout

| Step | What | Who |
|---|---|---|
| 0 | Section 13 ships (allowed before the gate). | Claude Code, founder merges |
| 1 | Gate opens: all four conditions hold and the founder says yes. | Founder |
| 2 | Migration (section 5) applied after a separate yes for the migration. | Founder yes, Claude Code applies |
| 3 | Server code merged with `EXPORT_CREDITS_ENABLED` unset (off). Nothing changes for users. | Claude Code |
| 4 | Three consumables created in App Store Connect; notification URL set; Paid Applications agreement and banking active. | Founder |
| 5 | iOS build with the sheet, tested in Sandbox and TestFlight against a preview deployment with the flag on. | Claude Code, founder tests on device |
| 6 | Build submitted with the products attached. Production flag still off; review purchases are Sandbox (F6). | Founder |
| 7 | Flag on in production. | Founder's yes in that message |
| 8 | Day 1, day 7: read `export_blocked`, `paywall_shown`, `purchase_completed`, `iap_verify_failed`. | Claude Code |

Kill switch: `EXPORT_CREDITS_ENABLED` off. Exports become free again at once, purchased balances
are kept, and no build is needed because the iOS app shows the sheet only on a server 402. For
that to hold, P3b removes the sheet's dependency on the compile-time
`BackendConfig.isMonetizationEnabled` (`Core/API/BackendConfig.swift:27`): the server decides.

P3b also deletes the dormant `ats_score` and `refine_section` charges that P2 put behind
`MONETIZATION_ENABLED`: credits are export credits only.

## 12. Tests (P3b writes them first)

Database (against a local Supabase, or a Supabase branch after the founder approves its cost; never production):
- `unlock_export`: with `p_charge` false nothing is spent and an `ungated` row is written; first charged unlock spends 1; second for the same optimization spends 0; balance 0 returns `insufficient` and writes nothing; another user's optimization returns `not_found`; 20 parallel calls for one optimization spend exactly 1; parallel calls for two optimizations with balance 1 unlock exactly one.
- `grant_apple_credits`: same transaction twice grants once; the same transaction for a second user is refused.
- Refund: deducts at most the current balance; the same `notificationUUID` twice deducts once.
- `anon` and `authenticated` cannot execute `unlock_export` or write `export_unlocks`.

Routes (Jest, mocked Supabase and verifier, the `tests/api/` harness):
- `/api/download/[id]`: gated with credits renders and spends once; gated without credits returns 402 and never calls a renderer; ungated never calls `unlock_export`; web client ungated even with the flag on (F1).
- `/api/v1/iap/verify`: every row of 7.2 has a test that fails on today's route first, including missing config (no grant), client `productId` different from the signed one, foreign `appAccountToken`, revoked transaction, quantity 2 grants twice the credits.
- `/api/v1/iap/notifications`: unverified payload changes nothing; `REFUND` and `REFUND_REVERSED` move the balance and are idempotent.

iOS (unit tests plus a Sandbox run):
- `finish()` is called only after a 200 from verify; an unfinished transaction is re-sent at launch.
- A 402 on export shows the sheet and never produces a local PDF (E6).
- The sheet shows StoreKit prices and no hardcoded price.

## 13. Fail closed now (allowed before the gate, recommended as the next story)

`/api/v1/iap/verify` grants 100 to 2,500 credits for any made-up transaction ID whenever
`APPLE_VERIFY_TRANSACTIONS_URL` is unset (`route.ts:33`). Whether it is set in Vercel production
was not checked on 2026-10-15. Today no route spends credits (after P2), and the ledger has no Apple
grant, so nothing has been lost. But balances carry into launch (F2), so credits minted now would
become free exports later.

Change: the route answers 503 `iap_verification_unavailable` and grants nothing until the full
section 7 verifier exists; one test pins it. No product, price, paywall or export decrement, so it
does not touch the gate. Before launch, read every `apple_iap` ledger row and void any without a
verified transaction.

## 14. Risks

- **Copy and screen capture.** Content shown on screen can always be copied (section 3). Accepted by
  design; the product sells the formatted, tailored file and the convenience.
- **Web bypass** while F1 holds. Measured by `export_unlocked` per platform.
- **Spend, then refund.** A user can export with credits and then get a refund from Apple; the
  balance floor is 0 and unlocked exports stay. Answering `CONSUMPTION_REQUEST` with usage data
  later would help Apple decide such refunds.
- **Throwaway accounts** for the free export. Bounded by AI cost per attempt (R1).
- **The in-memory rate limiter** (`src/lib/utils/rate-limit.ts`) is per server instance, so it limits
  less than its numbers say.
- **Apple review** can reject a build whose sheet does not explain what a credit buys, or whose
  purchase fails in Sandbox. Step 5 of the rollout exists for this.
- **R1 sample size.** Re-measure at 30 or more real exporters (R7) before any price change.

## 15. Done means

- Founder approves this spec. F1 to F6 are answered (2026-10-15).
- The Agentic OS work packet `executive-os/work-packets/WP-2-monetization-spec.md` points to this
  spec and states the pack shape (June spec section 10 asked for this).
- Gate conditions 2 and 3 are still the founder's and the traffic's; this spec does not move them.
