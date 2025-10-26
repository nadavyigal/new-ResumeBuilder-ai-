# Feature Specification: Credit-Based Pricing System - Epic 5

**Feature Branch**: `007-credit-based-pricing`  
**Created**: October 26, 2025  
**Status**: Draft  
**Input**: User description: "Credit-Based Pricing System - Epic 5"

## User Scenarios & Testing

### User Story 1 - Welcome Credits & Onboarding (Priority: P1)

**Description**: New users receive a small amount of free welcome credits upon signup to try the application before purchasing. The system grants these credits automatically, displays pricing packs, feature costs, and current credit balance so users can experience the product and make informed purchasing decisions.

**Why this priority**: This is the foundation of the monetization system. Welcome credits reduce friction for new users to try the product, increasing conversion to paid customers. Without this, users must pay before seeing value, which significantly reduces signup-to-purchase conversion.

**Independent Test**: Can be fully tested by creating a new user account and verifying welcome credits are granted, displaying pricing packs in a billing page, showing feature costs next to actions, and displaying the current credit balance in the header. Delivers immediate value and transparency about the payment model.

**Acceptance Scenarios**:

1. **Given** a new user signs up, **When** they complete registration, **Then** they automatically receive 3 free welcome credits to try the application
2. **Given** a new user views their dashboard, **When** they check their credit balance, **Then** they see 3 credits with a badge indicating "Welcome Credits"
3. **Given** a new user attempts resume optimization, **When** they click the optimize button, **Then** they can complete the action using their welcome credits (2 credits deducted, 1 remaining)
4. **Given** a user is on the resume upload page, **When** they view the optimization action, **Then** they see "Optimize Resume: 2 credits" displayed clearly next to any cost information
5. **Given** a user has never purchased credits, **When** they visit the billing page, **Then** they see all 4 credit pack options (Starter $6, Job Seeker $12, Career Upgrade $20, Pro $35) with feature cost breakdown
6. **Given** admin enables promo bonus at 20%, **When** a first-time purchaser completes a purchase, **Then** they receive +20% bonus credits on that first purchase only

---

### User Story 2 - Credit Deduction Per Feature Action (Priority: P1)

**Description**: When users attempt to use a feature (optimize resume, tailor to job, generate cover letter), the system checks their credit balance and deducts the appropriate amount BEFORE executing the action. If insufficient credits exist, users are blocked with a paywall modal.

**Why this priority**: This is how the monetization model is enforced. Without atomic deduction logic, users could exploit features without payment, or concurrent requests could lead to negative balances.

**Independent Test**: Can be fully tested by attempting an action with sufficient credits (should succeed and deduct), insufficient credits (should show paywall), and concurrent requests (should maintain data integrity). Delivers secure, reliable revenue protection.

**Acceptance Scenarios**:

1. **Given** a user has 5 credits (2 welcome + 3 purchased), **When** they attempt resume optimization (2 credits), **Then** credits are deducted atomically and the action proceeds successfully with 3 credits remaining
2. **Given** a user has 1 credit, **When** they attempt resume optimization (2 credits), **Then** the action is blocked with a modal explaining insufficient credits and a CTA to purchase a Starter Pack ($6)
3. **Given** two concurrent requests for the same user, **When** both attempt to deduct 2 credits from a balance of 3, **Then** only one succeeds (race condition handled)
4. **Given** a user has 0 credits, **When** they attempt any paid feature, **Then** they receive a 402 Payment Required response from the API with an error message
5. **Given** a user completes an optimization, **When** credits are deducted, **Then** a transaction record is created with `transaction_type='deduction'`, feature_type, and related_optimization_id linked

---

### User Story 3 - Stripe Payment Integration (Priority: P1)

**Description**: Users purchase credit packs through Stripe Checkout. Upon successful payment, a webhook processes the event and credits the user's account with the corresponding amount. Transactions are tracked for history, refunds, and analytics.

**Why this priority**: This is the revenue-generating mechanism. Without payment processing, users cannot purchase credits, and the business has no path to monetization. This is the critical blocker for production launch.

**Independent Test**: Can be fully tested by initiating a checkout session, completing payment with Stripe test cards, verifying webhook processing grants credits, and checking transaction history is recorded. Delivers complete end-to-end payment flow.

**Acceptance Scenarios**:

1. **Given** a user clicks "Buy Starter Pack" ($6 for 10 credits), **When** the checkout session completes, **Then** their browser redirects to Stripe Checkout with correct price and pack details
2. **Given** a user completes payment successfully, **When** Stripe sends the webhook event `checkout.session.completed`, **Then** the user's credit balance increases by 10 credits and a transaction record is created with `transaction_type='purchase'`
3. **Given** a user cancels checkout, **When** they return to the app, **Then** they are redirected to `/dashboard/billing/cancelled` with an option to try again
4. **Given** a webhook is sent twice (retry scenario), **When** the second webhook arrives, **Then** the system detects the duplicate and idempotently processes without double-crediting
5. **Given** optional subscriptions are enabled, **When** a user subscribes to Career Boost ($8/mo for 20 credits), **Then** they receive 20 credits monthly and a recurring transaction is created

---

### User Story 4 - Credit Balance & Transaction History UI (Priority: P2)

**Description**: Users can view their current credit balance at all times in the dashboard header, see detailed transaction history on a billing page (purchases, deductions, refunds), filter by transaction type, paginate results, and export to CSV for personal records.

**Why this priority**: This provides transparency and trust. Users need to understand their spending, verify transactions, and make informed decisions about when to purchase more credits. This reduces support queries and builds confidence in the payment system.

**Independent Test**: Can be fully tested by displaying balance in header, navigating to billing page to view transactions, applying filters, changing page size, and exporting to CSV. Delivers complete transaction visibility.

**Acceptance Scenarios**:

1. **Given** a user is logged in, **When** they view their dashboard, **Then** they see their credit balance prominently in the header with visual indicator (green if ≥10, yellow if 2-9, red if <2)
2. **Given** a user has made 50 transactions, **When** they visit `/dashboard/billing`, **Then** they see 20 transactions per page with pagination controls
3. **Given** a user wants to see only purchase transactions, **When** they filter by `transaction_type='purchase'`, **Then** only purchase records are displayed
4. **Given** a user wants to export their history, **When** they click "Export CSV", **Then** a CSV file downloads with all transaction details including date, type, amount, balance_after, and description
5. **Given** a user has low credits (<2), **When** they view the billing page, **Then** they see a prominent "Add Credits" CTA banner

---

### User Story 5 - Low Credit Notifications & Upsell (Priority: P2)

**Description**: The system proactively alerts users when their credit balance is low and offers contextual upsell opportunities based on usage patterns (e.g., after first optimization, recommend cover letter service; after 3 optimizations, suggest Job Seeker Pack).

**Why this priority**: This drives additional revenue through strategic prompting at key decision moments. Low-credit warnings prevent frustration from unexpected blocks, while contextual upsells increase lifetime value per user.

**Independent Test**: Can be fully tested by setting balance below thresholds, triggering warning modals, completing actions to trigger upsell banners, and verifying toast notifications show remaining balance. Delivers proactive engagement.

**Acceptance Scenarios**:

1. **Given** a user's balance drops to 1 credit, **When** they navigate to dashboard, **Then** a critical warning modal appears with options to buy Starter Pack immediately
2. **Given** a user completes their first resume optimization, **When** they view results, **Then** a banner suggests "Generate a matching cover letter for 3 credits" with purchase CTA
3. **Given** a user has optimized 3+ resumes, **When** they visit the billing page, **Then** they see a recommendation to upgrade to Job Seeker Pack (25 credits) with reasoning
4. **Given** a user completes an action that consumes credits, **When** the action finishes, **Then** a toast notification appears showing credits remaining (e.g., "Optimization complete! 3 credits remaining")
5. **Given** a user dismisses the low-credit modal, **When** they complete an action in the same session, **Then** the modal does not reappear until next session

---

### User Story 6 - Admin Analytics & Revenue Tracking (Priority: P3)

**Description**: Administrators can view comprehensive analytics including total revenue, ARPPU (Average Revenue Per Paying User), pack purchase distribution, conversion rates from low-credit modals, and cohort analysis (never purchased vs first-time buyers vs repeat purchasers).

**Why this priority**: This enables data-driven product decisions and business intelligence. Understanding revenue patterns, user segments, and conversion funnels helps optimize pricing and marketing strategies. This is important but not blocking for launch.

**Independent Test**: Can be fully tested by accessing admin-only analytics dashboard, viewing revenue charts, checking ARPPU calculations, analyzing pack mix distribution, and filtering by user cohorts. Delivers actionable business insights.

**Acceptance Scenarios**:

1. **Given** an admin user navigates to `/dashboard/admin/analytics`, **When** they view the revenue dashboard, **Then** they see total revenue, ARPPU, and pack mix charts (starter vs job seeker vs career upgrade vs pro)
2. **Given** an admin wants to understand conversion, **When** they filter analytics by users who saw low-credit modal, **Then** they see conversion rate to Starter Pack purchase
3. **Given** an admin wants cohort analysis, **When** they view the users tab, **Then** they see segmentation: never purchased, first-time buyers, repeat customers, and churned users
4. **Given** an admin wants to track credits, **When** they view the credits tab, **Then** they see credits purchased vs consumed ratio with trends over time
5. **Given** an admin wants historical data, **When** they set date range to last 30 days, **Then** revenue and user metrics are filtered appropriately

---

### Edge Cases

- **Welcome credit allocation**: What if user signs up with multiple accounts to get more welcome credits? (Answer: Welcome credits granted per legitimate signup; monitor for abuse patterns; eventually may require email verification)
- **Concurrent deductions**: What happens when two API requests simultaneously attempt to deduct credits from the same user? (Answer: Database transaction ensures atomicity; only one succeeds)
- **Webhook retries**: What if Stripe sends the same webhook event multiple times? (Answer: Idempotency check using session_id prevents double-crediting)
- **Welcome bonus transaction**: What if welcome credit grant fails during signup? (Answer: Retry mechanism in signup flow; audit log for failures; manual grant available via admin)
- **Partial refunds**: What if admin wants to refund specific features within a purchase? (Answer: Transaction linking allows granular refund tracking via `related_optimization_id`)
- **International payments**: What about currency conversion and international card fees? (Answer: Stripe handles currency conversion; fees accounted in margin model; show USD prices only)
- **Balance rollover**: What happens to unused credits if account is inactive? (Answer: Credits remain indefinitely until used; clarify in terms of service)
- **Subscription cancellations**: What if user cancels subscription mid-month? (Answer: They keep credits already granted; no refunds for partial months)
- **Promo bonus eligibility**: What if user creates multiple accounts? (Answer: Promo bonus is per-user, not per-session; first purchase on any account qualifies)
- **Failed deductions**: What if deduction succeeds but feature action fails? (Answer: Rollback transaction or refund credits; link transaction to failed action for audit trail)
- **Negative balance attempts**: What if technical glitch causes negative balance? (Answer: Add database constraint preventing negative balance; alert admin immediately)
- **Expired sessions**: What if user abandons checkout and returns later? (Answer: Session expires after 30 minutes; user must restart checkout)

## Requirements

### Functional Requirements

- **FR-001**: System MUST grant 3 free welcome credits to all new users upon signup to enable product trial
- **FR-002**: System MUST create a transaction record with `transaction_type='welcome_bonus'` when welcome credits are granted
- **FR-003**: System MUST display 4 credit pack options (Starter $6/10, Job Seeker $12/25, Career Upgrade $20/50, Pro $35/100) on billing page
- **FR-004**: System MUST display feature-based credit costs (resume: 2, tailoring: 1, cover letter: 3, LinkedIn: 4) next to each action
- **FR-005**: System MUST store credit balance in `profiles.credit_balance` column with DEFAULT 3.00 for new users (welcome credits)
- **FR-006**: System MUST display current credit balance in dashboard header with visual indicator (green ≥10, yellow 2-9, red <2)
- **FR-007**: System MUST prevent feature execution if user has insufficient credits for that feature
- **FR-008**: System MUST return 402 Payment Required when API receives request with insufficient credits
- **FR-009**: System MUST create transaction record for every credit deduction with feature_type and related_optimization_id
- **FR-010**: System MUST link all transactions to domain entities for refund tracking
- **FR-011**: System MUST create Stripe Checkout session for credit pack purchases
- **FR-012**: System MUST process Stripe webhook events to grant credits on successful payment
- **FR-013**: System MUST create transaction record with `transaction_type='purchase'` when credits are granted
- **FR-014**: System MUST verify Stripe webhook signature before processing payment events
- **FR-015**: System MUST support idempotent webhook processing (prevent double-crediting on retries)
- **FR-016**: System MUST display transaction history with pagination (20 per page, configurable)
- **FR-017**: System MUST allow filtering transaction history by `transaction_type` and `feature_type`
- **FR-018**: System MUST enable CSV export of transaction history for user records
- **FR-019**: System MUST trigger warning modal when balance drops below 2 credits
- **FR-020**: System MUST trigger critical modal when balance drops below 1 credit
- **FR-021**: System MUST display toast notification after each credit-consuming action showing remaining balance
- **FR-022**: System MUST support contextual upsell banners based on usage patterns
- **FR-023**: System MUST provide admin-only analytics dashboard with revenue, ARPPU, and user metrics
- **FR-024**: System MUST support optional promo bonus credits (configurable percentage) for first-time purchasers only
- **FR-025**: System MUST support optional monthly subscriptions (Career Boost $8/20, Career Pro $14/40)
- **FR-026**: System MUST process recurring subscription payments and grant monthly credits automatically
- **FR-027**: System MUST maintain atomic credit deductions using database transactions to prevent race conditions
- **FR-028**: System MUST log all credit transactions with created_at timestamp for audit trail
- **FR-029**: System MUST support refund transaction records with negative amounts
- **FR-030**: System MUST disable promo bonus for subsequent purchases after first use
- **FR-031**: System MUST handle subscription cancellation gracefully (user keeps existing credits)
- **FR-032**: System MUST prevent negative credit balances via database constraints or application logic

### Key Entities

- **profiles**: User profiles table with `credit_balance DECIMAL(10,2) DEFAULT 3.00` (welcome credits for new users), `total_credits_purchased DECIMAL(10,2) DEFAULT 0.00`, `promo_bonus_applied BOOLEAN DEFAULT false`
- **credit_transactions**: Transaction history table with `transaction_type` (purchase/deduction/refund/promo_bonus/welcome_bonus), `feature_type` (resume_optimization/job_tailoring/cover_letter/linkedin_rewrite), `amount`, `balance_after`, `related_optimization_id`, metadata
- **stripe_payments**: Payment records table with `stripe_checkout_session_id`, `stripe_payment_intent_id`, `pack_type`, `is_subscription`, `amount_paid_cents`, `credits_granted`, `status`, payment metadata
- **Credit Pack**: Configuration for purchasable credit bundles (Starter, Job Seeker, Career Upgrade, Pro)
- **Feature Cost**: Variable credit cost per feature type (resume optimization, job tailoring, cover letter, LinkedIn rewrite)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Welcome credits (3 credits) are granted automatically within 500ms of user signup completion
- **SC-002**: Users can complete credit pack purchase in under 2 minutes from click to credits granted
- **SC-003**: System processes Stripe webhook events within 3 seconds of receipt
- **SC-004**: Credit deduction API checks balance and performs operation within 100ms for 95th percentile
- **SC-005**: 95% of users who reach low-credit paywall successfully convert to Starter Pack purchase within session
- **SC-006**: Zero race conditions in concurrent credit deduction scenarios (100% atomicity)
- **SC-007**: 100% of successful payments result in correct credit grant (verified via transaction audit trail)
- **SC-008**: Transaction history export generates CSV within 2 seconds for up to 1,000 transactions
- **SC-009**: Admin dashboard renders analytics charts within 1 second for up to 10,000 users
- **SC-010**: Low-credit modal displays with sub-200ms response time (no user-perceptible delay)
- **SC-011**: Promo bonus applies correctly to exactly 1 first purchase per user (verified by promo_bonus_applied flag)

### Business Metrics

- **BM-001**: Track ARPPU (Average Revenue Per Paying User) with target ≥$25 per paying user
- **BM-002**: Measure pack mix distribution (target: 40% Starter, 30% Job Seeker, 20% Career Upgrade, 10% Pro)
- **BM-003**: Calculate conversion rate from low-credit paywall to purchase (target ≥15%)
- **BM-004**: Track credits purchased vs consumed ratio (target: healthy balance with revenue-driven purchases)
- **BM-005**: Segment users by purchase behavior (never purchased, first-time buyer, repeat customer, churned)
- **BM-006**: Monitor monthly recurring revenue (MRR) from optional subscription tiers
- **BM-007**: Measure first-purchase conversion rate for promo bonus offer (target ≥8% of all users)
- **BM-008**: Track feature usage distribution to optimize credit costs over time
- **BM-009**: Measure welcome credit usage rate (target: ≥80% of new users consume at least 2 welcome credits within 7 days of signup)
