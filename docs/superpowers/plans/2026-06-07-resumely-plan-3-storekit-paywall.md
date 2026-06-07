# Resumely Plan 3: StoreKit Paywall — iOS IAP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Resumely paywall using StoreKit 2 — four purchase options (Tier 1–4 from the spec), a paywall sheet that appears at export, credit balance management in Supabase, and receipt validation. This is the iOS in-app purchase implementation.

**Architecture:**
- StoreKit 2 native API for product loading, purchase, and receipt validation
- Supabase edge function (`/functions/v1/storekit-verify`) for server-side receipt verification and credit grant
- Credit balance stored in Supabase (`user_credits` table)
- Paywall sheet is a SwiftUI `.sheet` presented from the export button tap
- Feature flag `paywall_enabled` in PostHog controls rollout

**Tech Stack:** SwiftUI, StoreKit 2, Supabase Swift client, Capacitor (bridge to web app for web-triggered exports)

**Status gate:** GATED — do not start until:
1. CFO validates prices (OpenAI cost/optimization confirmed)
2. Apple IAP rate confirmed (30% vs 15%)
3. First-cohort D7 activation data readable in PostHog (EXD-009)
4. Separate StoreKit IAP engineering spec written and approved

**This plan is a skeleton.** It documents the architecture and task structure. Detailed implementation steps (with complete Swift code) should be filled in when the gate opens and the engineering spec is written. Starting implementation before the gate is a violation of EXD-009.

---

## Product IDs to Create in App Store Connect

Before any code, create these products in App Store Connect → your app → In-App Purchases:

| Product ID | Type | Price Tier | Name |
|---|---|---|---|
| `com.resumely.export.single` | Consumable | Tier to confirm | Single Export |
| `com.resumely.export.pack5` | Consumable | Tier to confirm | 5-Export Pack |
| `com.resumely.export.pack10` | Consumable | Tier to confirm | 10-Export Pack |
| `com.resumely.unlimited.monthly` | Auto-Renewable Subscription | Tier to confirm | Unlimited Monthly |
| `com.resumely.unlimited.annual` | Auto-Renewable Subscription | Tier to confirm | Unlimited Annual |

**Note:** Prices cannot be set until CFO validation is complete (spec Section 6). Create the products in App Store Connect with placeholder pricing; update when CFO sign-off is received.

---

## Supabase Schema (to write in a separate migration)

```sql
-- User credit balance
create table if not exists user_credits (
  user_id uuid references auth.users(id) on delete cascade primary key,
  export_credits integer not null default 0,
  is_unlimited boolean not null default false,
  unlimited_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Purchase history
create table if not exists iap_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id text not null,
  transaction_id text unique not null,
  original_transaction_id text,
  purchase_date timestamptz not null,
  credits_granted integer not null default 0,
  is_subscription boolean not null default false,
  verified_at timestamptz default now()
);

-- RLS
alter table user_credits enable row level security;
create policy "Users read own credits" on user_credits for select using (auth.uid() = user_id);

alter table iap_purchases enable row level security;
create policy "Users read own purchases" on iap_purchases for select using (auth.uid() = user_id);
```

---

## File Structure (iOS App)

| File | Action | Contents |
|---|---|---|
| `ResumelyApp/Payments/StoreManager.swift` | Create | StoreKit 2 product loading, purchase, and transaction observer |
| `ResumelyApp/Payments/PaywallView.swift` | Create | SwiftUI paywall sheet with 4 tier cards |
| `ResumelyApp/Payments/CreditManager.swift` | Create | Local credit balance cache + Supabase sync |
| `ResumelyApp/Payments/PurchaseTier.swift` | Create | Enum defining the 4 tiers with display name, description, badge |
| `supabase/functions/storekit-verify/index.ts` | Create | Edge function: verifies StoreKit receipt + grants credits |

---

### Task 1: Define Purchase Tiers

**Files:**
- Create: `ResumelyApp/Payments/PurchaseTier.swift`

- [ ] **Step 1: Write tier enum**

```swift
// ResumelyApp/Payments/PurchaseTier.swift
import Foundation

enum PurchaseTier: CaseIterable {
    case singleExport
    case pack5
    case pack10
    case unlimitedMonthly
    case unlimitedAnnual

    var productID: String {
        switch self {
        case .singleExport: return "com.resumely.export.single"
        case .pack5: return "com.resumely.export.pack5"
        case .pack10: return "com.resumely.export.pack10"
        case .unlimitedMonthly: return "com.resumely.unlimited.monthly"
        case .unlimitedAnnual: return "com.resumely.unlimited.annual"
        }
    }

    var displayName: String {
        switch self {
        case .singleExport: return "Single Export"
        case .pack5: return "5-Export Pack"
        case .pack10: return "10-Export Pack"
        case .unlimitedMonthly: return "Unlimited Monthly"
        case .unlimitedAnnual: return "Unlimited Annual"
        }
    }

    var creditsGranted: Int {
        switch self {
        case .singleExport: return 1
        case .pack5: return 5
        case .pack10: return 10
        case .unlimitedMonthly, .unlimitedAnnual: return 0 // unlimited flag, not credits
        }
    }

    var isMostPopular: Bool {
        return self == .pack5
    }

    var isSubscription: Bool {
        return self == .unlimitedMonthly || self == .unlimitedAnnual
    }
}
```

- [ ] **Step 2: Build succeeds**

Build in Xcode. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "ResumelyApp/Payments/PurchaseTier.swift"
git commit -m "feat: define StoreKit purchase tiers for Resumely paywall"
```

---

### Task 2: StoreManager

**Files:**
- Create: `ResumelyApp/Payments/StoreManager.swift`

> **Placeholder — complete with full Swift code when engineering spec is written.**

The StoreManager should:
- Load products from App Store using `Product.products(for: productIDs)` (StoreKit 2)
- Expose `@Published var products: [Product]` grouped by tier
- Handle purchase via `product.purchase()`
- Observe `Transaction.updates` async sequence for all transaction states
- On successful transaction: call Supabase verify edge function with `originalTransactionID`
- On restore: re-verify all past transactions

---

### Task 3: PaywallView

**Files:**
- Create: `ResumelyApp/Payments/PaywallView.swift`

> **Placeholder — complete with full SwiftUI code when engineering spec is written.**

The PaywallView should:
- Show 4 tier cards in a vertical scroll (or 2x2 grid on larger phones)
- Highlight `.pack5` with "MOST POPULAR" badge
- Show the price loaded from StoreKit (never hardcode a price in the UI — use `product.displayPrice`)
- "Restore Purchases" link at bottom
- Dismiss button (X) in top right
- On purchase success: dismiss sheet + proceed with export

---

### Task 4: Supabase Verify Edge Function

**Files:**
- Create: `supabase/functions/storekit-verify/index.ts`

> **Placeholder — complete with full TypeScript code when engineering spec is written.**

The edge function should:
- Accept `{ originalTransactionID, userID, productID }` POST body
- Call Apple's App Store Server API to verify the transaction
- On valid: upsert `iap_purchases` row and update `user_credits`
- Return `{ success: true, creditsGranted, isUnlimited }`
- Idempotent: if `transaction_id` already exists in `iap_purchases`, return success without double-granting

---

### Task 5: Export Button Paywall Gate

**Files:**
- Modify: existing export button handler in the iOS app

> **Placeholder — find the export button in the iOS app, add a paywall gate.**

The export button handler should:
1. Check `CreditManager.hasCredits()` (or `isUnlimited`)
2. If yes: proceed with export
3. If no: present `PaywallView` as a sheet
4. After `PaywallView` dismisses: re-check credits. If now have credits: proceed. If still no: do nothing (user cancelled).

---

## Self-Review

This plan is intentionally skeletal — it documents architecture, data model, and file structure. Full implementation steps are deferred to when the gate opens and the engineering spec is written.

Gate conditions (from spec Section 8 + EXD-009):
- CFO price validation
- D7 activation data readable
- Engineering spec written and approved
