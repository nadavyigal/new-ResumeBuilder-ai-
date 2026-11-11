# Resumely billing switch preflight, 2026-11-08

**Switched on 2026-11-08, 18:42 UTC, on the founder's yes** (deploy `new-resume-builder-83vqo92my`, decision EXD-041). Before the switch: server and App Store Connect checks passed (App Store Connect checked later the
same day, signed in), with the accepted risks listed below. Sandbox purchases ran through the
production server; a real purchase before the switch was optional and the founder declined it.
So the gate and a real sale are **not yet proven in production**: see "Production state, 2026-11-11".

The switch is the Vercel production env var `EXPORT_CREDITS_ENABLED` on project
`new-resume-builder-ai` (`src/lib/export-credits.ts:51`). It was not set before 2026-11-08; it is now `true`.
It gates iOS exports only; the web stays free (spec 6.5, F1). Kill switch: delete it or set it to
anything but `true`, then redeploy.

## Checklist

Sources: spec rollout table (`docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md`
section 11), `tasks/progress.md` founder steps, iOS `docs/qa/2026-10-31-ios-go-no-go.md`
(branch `claude/resumely-pricing-v2`).

| # | Item | State | Evidence (checked 2026-11-08) |
|---|---|---|---|
| 1 | 1.6.0 live on the App Store | **Verified** | Apple lookup, id 6776752349, US and IL, varying query: version 1.6.0, released 2026-11-07T03:07:05Z. Release notes name the 5 and 14 packs and Pro. |
| 2 | Credit migrations applied in production | **Verified** | Supabase `brtdyamysfmctrhuankn` has all 7 repo migrations, up to `20261030094500_pricing_v2`, including `20261021120000_export_credits` and `20261023120000_apple_iap_verification`. |
| 3 | `EXPORT_CREDITS_USER_IDS` includes the founder's test account | **Verified** | Production value lists 6 accounts. All 6 are the founder's own gmail accounts (created 2025-10-02 to 2026-11-05). Set 2026-11-05 13:49 UTC, before the current production deploy (17:46 UTC, `7a36835`), so it is live. |
| 4 | Apple verification config for real money | **Verified** | `APPLE_IAP_ALLOWED_ENVIRONMENTS=Production,Sandbox`, `APPLE_IAP_BUNDLE_ID` and `APPLE_IAP_APP_APPLE_ID=6776752349` are set in production. Production is allowed, so a real purchase is verified and granted. |
| 5 | Purchase path works end to end on the production server | **Verified, Sandbox only** | Ledger: 5 Apple grants, all Sandbox (`exports.5.v2` x2, `exports.14` x1, old `exports.5` and `exports.10` x1 each). 1 subscription row. **0 Production purchases ever.** |
| 6 | Paid Applications agreement and banking Active | **Verified** | App Store Connect, Business: Paid Apps Agreement Active (21 Oct 2026 to 20 Mar 2027), bank account Active (ILS), W-8BEN Active. |
| 7 | Products Approved | **Verified** | In-App Purchases: `resumely.exports.14` and `resumely.exports.5.v2` Approved. Subscription group "Resumely Pro" has 1 subscription, server environments Production and Sandbox. |
| 8 | Old `credits_*` packs (1.5.6 era) | **Verified gone** | Not listed in App Store Connect. The server grants 0 credits for any `credits_*` ID (`src/lib/iap.ts:27`), so this mattered. |
| 9 | v1 packs `resumely.exports.1/.5/.10` | **Verified, still Approved** | Still on sale. The server honors them, so a buyer gets what they paid for. 1.6.0 does not show them; only a 1.5.6 sheet can. That keeps the 1.5.6 sheet working. Leave as is. |
| 10 | Server notification URL (refunds) | **Not verified** | Needs App Store Connect. Not blocking a sale; refunds just will not deduct until set. |
| 11 | Small Business Program (15% rate, R8) | **Founder only** | Not checkable here. Not blocking: it only changes Apple's cut. |
| 12 | עוסק פטור approval (file opened 2026-10-31) | **Founder only** | Your accountant's answer. Taxes on Apple payouts depend on it. |
| 13 | Accountant sign-off | **Founder only** | Same. |

## Production state, 2026-11-11 (read-only)

Read with the Vercel CLI (team `nadavyigal-gmailcoms-projects`, signed in as `nadavyigal-7990`) and
read-only aggregate SQL on Supabase `brtdyamysfmctrhuankn` (counts only, no personal data). Nothing
was changed.

- **Target:** Vercel project `new-resume-builder-ai`, environment Production, domain
  www.resumelybuilderai.com.
- **Serving:** deploy `new-resume-builder-83vqo92my`, created 2026-11-08 18:42 UTC, commit `7a36835`
  (main, merge of #208). No production deploy since.
- **Billing configuration:** `EXPORT_CREDITS_ENABLED` exists for Production only, last updated
  2026-11-08 18:41 UTC, one minute before that deploy, so the deploy carries it. Its value was read back
  as `true` on 2026-11-08 and not re-read today (it is encrypted; reading it means decrypting a secret).
  `EXPORT_CREDITS_USER_IDS` last updated 2026-11-05 13:49 UTC. `APPLE_IAP_*` last updated 2026-10-24.

Four different things, kept apart:

| What | State 2026-11-11 | Evidence |
|---|---|---|
| Billing configuration on | **Yes** | Env var and deploy times above. |
| Exports actually gated | **Not observed yet** | 0 `export_unlocks` rows of any source since 18:42 UTC on 8 Nov. 0 new optimizations since 2026-11-05 (last day with any: 13 optimizations, 4 users). No export has reached the gate since the switch. |
| Sandbox purchases | **5 pack grants, 1 Pro** | `credit_transactions`: 5 `iap_purchase` rows, all Sandbox, 3 users, last 2026-11-05. `subscriptions`: 1 Sandbox `resumely.pro.monthly`. |
| Real revenue | **None** | 0 rows with `environment = 'Production'` in `credit_transactions` or `subscriptions`, ever. |

## Accepted risks (open after the switch)

- **App Store server notification URL (row 10) not verified.** Until it is set, a refund or revoked
  Pro does not reach the server, so the buyer keeps the credits or Pro access.
- **First real buyer not observed.** The production purchase path is proven with Sandbox only.
- **The gate has not run for a real user** (see the table above).
- **Founder only:** עוסק פטור approval, accountant sign-off, Small Business Program.

## What changes for users when the flag is on

- iOS users with 0 credits and no Pro get a 402 at export, and the paywall opens.
- Every account still gets 3 free PDF downloads first (welcome grant). Match Scores stay free.
- The web stays free.
- Someone still on 1.5.6 who used up 3 free exports gets the old sheet with the v1 packs, which are
  still on sale and still honored. No dead end.

## Order

**A. Founder: named yes** in the session: "yes, set EXPORT_CREDITS_ENABLED=true in production and redeploy".

**B. Claude:** set the var in Vercel production, redeploy production, confirm the new deploy is READY.

**C. Claude checks the gate** with a fresh lock. All four must hold, or the test proves nothing:
- an account outside `EXPORT_CREDITS_USER_IDS`;
- credit balance 0 (its 3 welcome credits already used);
- no active Pro subscription;
- an optimization with **no `export_unlocks` row**. `unlock_export`
  (`supabase/migrations/20261030094500_pricing_v2.sql`) answers `already_unlocked` before it checks the
  balance, so a CV exported before the switch, or one unlocked with welcome credits, exports again
  with no paywall.

Expected: 402 with `error: 'export_credits_required'` and `balance: 0` (the paywall trigger,
`src/lib/export-credits.ts:235-246`), an `export_blocked` event, and no new row in `export_unlocks` or
`credit_transactions`. Record it in `tasks/progress.md` and add a decision note.

**D. Claude, after the first real sale.** Check by product, because packs and Pro write different tables:
- **Pack** (`resumely.exports.5.v2` or `resumely.exports.14`): exactly one `credit_transactions` row
  with `reason = 'iap_purchase'`, `environment = 'Production'`, `delta` 5 or 14 matching the product,
  and no second row for the same `apple_transaction_id`. Then a fresh locked optimization (as in C)
  unlocks with `source = 'credit'` and one `export_unlock` row with `delta = -1`.
- **Pro** (`resumely.pro.monthly`): one `subscriptions` row with `environment = 'Production'` and
  `expires_at` in the future, and **no** `credit_transactions` purchase row. Then a fresh locked
  optimization unlocks with `source = 'subscription'` and the credit balance does not change.

Kill switch at any time: remove the var or set it to anything but `true`, then redeploy.
