# Implementation Plan: Credit-Based Pricing System - Epic 5

**Branch**: `007-credit-based-pricing` | **Date**: October 26, 2025 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-credit-based-pricing/spec.md`

## Summary

Implement a complete credit-based pricing and monetization system for the Resume Builder AI application. The system replaces the current freemium model with a flexible credits-and-bundles approach, featuring welcome credits for new users, variable-cost features (resume optimization, job tailoring, cover letter, LinkedIn rewrite), Stripe payment integration, comprehensive transaction tracking, and admin analytics.

**Technical Approach**: 
- Database migrations to add credit columns, transaction tables, and Stripe payment records
- API middleware to enforce credit checks before feature execution
- Stripe Checkout integration with webhook processing
- React UI components for billing, transaction history, and low-credit notifications
- Next.js API routes for credit management and payment processing

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+, Next.js 14+ (App Router)

**Primary Dependencies**: 
- Stripe SDK (`stripe`) for payment processing
- Next.js server actions and route handlers for API
- Supabase client for database operations
- React hooks for client-side state management
- shadcn/ui components for consistent UI

**Storage**: 
- PostgreSQL via Supabase
- Additional tables: `credit_transactions`, `stripe_payments`
- Modified `profiles` table with credit columns

**Testing**: 
- Jest / Vitest for unit tests
- Integration tests for API routes
- E2E tests for payment flow
- Stripe test mode for payment testing

**Target Platform**: 
- Web application (Next.js App Router)
- Server-side rendering for secure operations
- Client components for interactive UI

**Project Type**: Web application (Next.js + React)

**Performance Goals**: 
- Welcome credits granted within 500ms
- Credit check/deduction API within 100ms (95th percentile)
- Stripe webhook processing within 3 seconds
- Transaction export within 2 seconds for 1,000 records
- Admin analytics dashboard within 1 second

**Constraints**: 
- Atomic credit deductions (database transactions)
- Idempotent webhook processing
- Real-time balance updates
- No negative balances (database constraints)
- RLS policies for data security

**Scale/Scope**: 
- 10,000+ users
- 20+ API endpoints
- 3 database tables
- 15+ React components

## Constitution Check

✅ **Gate: Feature completeness** - All 6 stories defined with clear acceptance criteria  
✅ **Gate: Technical feasibility** - Stripe integration and database schema validated  
✅ **Gate: Security requirements** - RLS policies, webhook signature verification specified  
⚠️ **Gate: Test coverage** - Will be addressed in Phase 2 (tasks.md)  
✅ **Gate: Documentation** - Comprehensive specification with edge cases  

## Project Structure

### Documentation (this feature)

```
specs/007-credit-based-pricing/
├── plan.md              # This file
├── spec.md              # Feature specification (COMPLETE)
├── research.md          # Phase 0: Technology research (TO BE CREATED)
├── data-model.md        # Phase 1: Database schema (TO BE CREATED)
├── quickstart.md        # Phase 1: Integration guide (TO BE CREATED)
├── contracts/           # Phase 1: API contracts (TO BE CREATED)
│   └── api-credits.md
└── tasks.md             # Phase 2: Task breakdown (TO BE CREATED)
```

### Source Code (repository root)

**Next.js App Router Structure**:

```
resume-builder-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── credits/
│   │   │   │   ├── purchase/route.ts           # POST /api/credits/purchase
│   │   │   │   ├── transactions/route.ts       # GET /api/credits/transactions
│   │   │   │   └── deduct/route.ts             # POST /api/credits/deduct
│   │   │   └── webhooks/
│   │   │       └── stripe/route.ts              # POST /api/webhooks/stripe
│   │   │
│   │   ├── dashboard/
│   │   │   ├── billing/
│   │   │   │   ├── page.tsx                    # Billing page
│   │   │   │   ├── success/page.tsx           # Checkout success
│   │   │   │   └── cancelled/page.tsx          # Checkout cancelled
│   │   │   └── admin/
│   │   │       └── analytics/page.tsx          # Admin analytics
│   │   │
│   │   └── ...
│   │
│   ├── components/
│   │   ├── billing/
│   │   │   ├── CreditBalance.tsx               # Header balance display
│   │   │   ├── PurchaseCreditsButton.tsx       # CTA button
│   │   │   ├── TransactionHistory.tsx           # History table
│   │   │   └── CreditBalanceIndicator.tsx       # Visual indicator
│   │   └── credits/
│   │       ├── LowCreditWarning.tsx            # Warning modal
│   │       ├── CreditDepletedModal.tsx         # Critical modal
│   │       ├── InsufficientCreditsModal.tsx    # Paywall modal
│   │       └── UpsellBanner.tsx                 # Contextual upsell
│   │
│   ├── lib/
│   │   ├── credits/
│   │   │   ├── costs.ts                        # Feature cost constants
│   │   │   ├── deduct-credits.ts               # Deduction logic
│   │   │   └── export-csv.ts                   # CSV export
│   │   └── stripe/
│   │       ├── client.ts                       # Stripe client
│   │       ├── create-checkout.ts              # Checkout session
│   │       └── verify-webhook.ts               # Webhook verification
│   │
│   └── ...
│
├── supabase/
│   └── migrations/
│       ├── YYYYMMDD_add_credit_system.sql      # profiles + credit columns
│       ├── YYYYMMDD_add_credit_transactions.sql
│       └── YYYYMMDD_add_stripe_payments.sql
│
└── ...
```

**Structure Decision**: Web application with Next.js App Router pattern. Feature-specific routes organized under `/api/credits` and `/api/webhooks`. React components organized by feature domain (`billing`, `credits`). Database migrations follow Supabase conventions.

## Complexity Tracking

No violations - straightforward web application feature with external payment integration.

## Progress Tracking

### Phase 0: Research ✅ Complete

**Status**: ✅ Complete  
**Output**: `research.md`

- [x] Research Stripe Checkout session flow
- [x] Research Stripe webhook handling patterns
- [x] Research atomic credit deduction patterns
- [x] Research idempotency for webhook processing
- [x] Research transaction export patterns

### Phase 1: Design ✅ Complete

**Status**: ✅ Complete  
**Outputs**: `data-model.md`, `quickstart.md`, `contracts/api-credits.md`

- [x] Design database schema (3 tables)
- [x] Design API contracts (6 endpoints)
- [x] Design UI component architecture
- [x] Create integration guide

### Phase 2: Tasks (Not Started)

**Status**: ⏹️ Not Started  
**Output**: `tasks.md`

- [ ] Break down stories into actionable tasks
- [ ] Assign priorities (P1/P2/P3)
- [ ] Estimate effort (3 weeks timeline)
- [ ] Define dependencies

## Next Steps

1. Complete Phase 0: Research (generate `research.md`)
2. Complete Phase 1: Design (generate `data-model.md`, `quickstart.md`, `contracts/`)
3. Complete Phase 2: Tasks (generate `tasks.md`)
4. Begin implementation

