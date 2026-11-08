# Resumely billing switch preflight, 2026-11-08

**Switched on 2026-11-08, 18:42 UTC, on the founder's yes** (deploy `new-resume-builder-83vqo92my`, decision EXD-040). Before the switch: **ready.** Server and App Store Connect are verified (App Store Connect checked
later the same day, signed in). A real purchase before the switch is optional: the Sandbox purchases
already ran through the production server, and the founder declined it. The first real buyer's
ledger row is checked after the switch instead.

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

## What changes for users when the flag is on

- iOS users with 0 credits and no Pro get a 402 at export, and the paywall opens.
- Every account still gets 3 free PDF downloads first (welcome grant). Match Scores stay free.
- The web stays free.
- Someone still on 1.5.6 who used up 3 free exports gets the old sheet with the v1 packs, which are
  still on sale and still honored. No dead end.

## Order

**A. Founder: named yes** in the session: "yes, set EXPORT_CREDITS_ENABLED=true in production and redeploy".

**B. Claude:** set the var in Vercel production, redeploy production, confirm the new deploy is READY.

**C. Claude checks:** an iOS export request from an account outside the test list with 0 credits
gets 402 `export_credits_required` (the paywall trigger); record it in `tasks/progress.md` and add
a decision note.

**D. Claude, after the first real sale:** a `credit_transactions` row with
`environment = 'Production'` and the right `delta`, and the export unlocked with `source = 'credit'`.

Kill switch at any time: remove the var or set it to anything but `true`, then redeploy.
