# Resumely billing switch preflight, 2026-11-08

**Verdict: the server side is ready. Do not switch yet.** Two things stand between us and the switch:
one real purchase on the live app, and an App Store Connect check I could not do (Chrome is not
signed in there).

The switch is the Vercel production env var `EXPORT_CREDITS_ENABLED` on project
`new-resume-builder-ai` (`src/lib/export-credits.ts:51`). It is **not set** today, so it is off.
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
| 6 | Paid Applications agreement and banking Active | **Not verified** | Chrome is not signed in to App Store Connect. The real purchase in step A below proves it either way: no agreement means no products load. |
| 7 | 3 products Approved and Cleared for Sale | **Not verified** | Same reason. Inference: they were attached to 1.6.0, which Apple approved, so they are most likely Approved. |
| 8 | Old `credits_*` packs (1.5.6 era) removed from sale | **Not verified, founder** | The server grants **0** credits for any `credits_*` ID (`src/lib/iap.ts:27`). If one is still on sale, a buyer pays and gets nothing. Remove from sale. |
| 9 | Retired v1 packs `resumely.exports.1/.5/.10` | **Not verified, founder** | The server still honors them. The code says they were removed from sale. Keep them removed. |
| 10 | Server notification URL (refunds) | **Not verified** | Needs App Store Connect. Not blocking a sale; refunds just will not deduct until set. |
| 11 | Small Business Program (15% rate, R8) | **Founder only** | Not checkable here. Not blocking: it only changes Apple's cut. |
| 12 | עוסק פטור approval (file opened 2026-10-31) | **Founder only** | Your accountant's answer. Taxes on Apple payouts depend on it. |
| 13 | Accountant sign-off | **Founder only** | Same. |

## What changes for users when the flag is on

- iOS users with 0 credits and no Pro get a 402 at export, and the paywall opens.
- Every account still gets 3 free PDF downloads first (welcome grant). Match Scores stay free.
- The web stays free.
- Risk: someone still on 1.5.6 who used up 3 free exports gets the old sheet, which asks for the
  retired v1 packs. If those are off sale, that sheet is empty. Most phones auto-update; traffic
  is low. Accepted, not blocking.

## Order

**A. Founder: one real purchase before the switch.**
1. On your iPhone, install 1.6.0 from the **App Store** (not TestFlight; TestFlight is Sandbox).
2. Sign in with one of your gated accounts that has **0 credits** (three of the six do: the ones
   created 2026-11-01 and 2026-11-05), so the export opens the paywall.
3. Tap export on any tailored CV. Buy the **5-pack ($3.99)**. There is no 1-export pack in 1.6.0;
   the 5-pack is the cheapest.
4. The export should run right after the purchase.
5. Tell Claude "bought".

**B. Claude checks (read-only):** a `credit_transactions` row with `environment = 'Production'`,
`product_id = 'resumely.exports.5.v2'`, `delta = 5`; balance 5 then 4 after the export; an
`export_unlocks` row with `source = 'credit'`.

**C. Founder: App Store Connect.** Confirm rows 8 and 9 (no old pack on sale).

**D. Founder: named yes.** "yes, set EXPORT_CREDITS_ENABLED=true in production and redeploy".

**E. Claude after the switch:** set the var, redeploy production, then check with a non-gated
account at 0 credits that the iOS export gets 402 and the paywall; record it in
`tasks/progress.md` and add a decision note.
