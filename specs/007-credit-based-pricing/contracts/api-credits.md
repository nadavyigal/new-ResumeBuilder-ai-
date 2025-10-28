# API Contracts: Credit-Based Pricing System

**Feature**: Epic 5 - Credit-Based Pricing System  
**Date**: October 26, 2025  
**Base URL**: `/api`

## Overview

API endpoints for credit-based pricing system including purchase flow, credit deduction, transaction history, and Stripe webhooks.

---

## Endpoints

### 1. Purchase Credits

**POST** `/api/credits/purchase`

Create Stripe Checkout session for credit pack purchase.

**Request**:
```json
{
  "packType": "starter_10" | "job_seeker_25" | "career_upgrade_50" | "pro_100"
}
```

**Response** (200):
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Response** (400 - Invalid pack type):
```json
{
  "error": "Invalid pack type"
}
```

**Response** (401 - Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

---

### 2. Deduct Credits

**POST** `/api/credits/deduct`

Deduct credits before executing feature action.

**Request**:
```json
{
  "featureType": "resume_optimization" | "job_tailoring" | "cover_letter" | "linkedin_rewrite",
  "relatedOptimizationId": "uuid-optional"
}
```

**Response** (200 - Success):
```json
{
  "success": true,
  "balanceAfter": 3.00,
  "transactionId": "uuid"
}
```

**Response** (402 - Insufficient Credits):
```json
{
  "success": false,
  "error": "Insufficient credits",
  "currentBalance": 1.00,
  "required": 2.00
}
```

**Response** (401 - Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

**Response** (400 - Invalid feature type):
```json
{
  "error": "Invalid feature type"
}
```

---

### 3. Get Transaction History

**GET** `/api/credits/transactions?page=1&limit=20&type=purchase`

Retrieve paginated transaction history.

**Query Parameters**:
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `type`: "purchase" | "deduction" | "refund" | "promo_bonus" | "welcome_bonus" (optional filter)
- `featureType`: "resume_optimization" | "job_tailoring" | "cover_letter" | "linkedin_rewrite" (optional filter)

**Response** (200):
```json
{
  "transactions": [
    {
      "id": "uuid",
      "transactionType": "deduction",
      "featureType": "resume_optimization",
      "amount": -2.00,
      "balanceAfter": 1.00,
      "description": "Resume optimization",
      "relatedOptimizationId": "uuid",
      "createdAt": "2025-10-26T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Response** (401 - Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

---

### 4. Export Transactions (CSV)

**GET** `/api/credits/transactions/export`

Export transaction history as CSV.

**Query Parameters** (same as GET `/api/credits/transactions`)

**Response** (200):
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="transactions.csv"`
- Body: CSV data

**Response** (401 - Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

---

### 5. Stripe Webhook

**POST** `/api/webhooks/stripe`

Process Stripe webhook events (payment completed, invoice paid, etc.).

**Request Headers**:
- `stripe-signature`: Stripe webhook signature

**Request Body**: Stripe event JSON

**Response** (200):
```json
{
  "received": true,
  "eventType": "checkout.session.completed"
}
```

**Response** (400 - Invalid signature):
```json
{
  "error": "Invalid signature"
}
```

**Response** (200 - Duplicate event):
```json
{
  "received": true,
  "alreadyProcessed": true
}
```

---

### 6. Get Credit Balance

**GET** `/api/credits/balance`

Get current credit balance.

**Response** (200):
```json
{
  "balance": 3.00,
  "totalPurchased": 10.00,
  "welcomeCreditsUsed": true
}
```

**Response** (401 - Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

---

## Feature Costs

| Feature Type | Cost |
|--------------|------|
| `resume_optimization` | 2 credits |
| `job_tailoring` | 1 credit |
| `cover_letter` | 3 credits |
| `linkedin_rewrite` | 4 credits |

## Pack Types

| Pack Type | Price | Credits |
|-----------|-------|---------|
| `starter_10` | $6 | 10 |
| `job_seeker_25` | $12 | 25 |
| `career_upgrade_50` | $20 | 50 |
| `pro_100` | $35 | 100 |

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | User not authenticated |
| 402 | Payment Required | Insufficient credits |
| 500 | Server Error | Internal server error |

## Authentication

All endpoints require authentication via Supabase session cookie.

```
Authorization: Bearer <supabase_jwt>
```

## Rate Limiting

- `/api/credits/deduct`: 10 requests/minute per user
- `/api/webhooks/stripe`: 100 requests/minute (global)
- Other endpoints: 60 requests/minute per user

## Implementation Notes

- All monetary values in USD
- All timestamps in ISO 8601 format (UTC)
- Credit deductions are atomic (database transaction)
- Webhook processing is idempotent (duplicate events ignored)

## Status

**Phase 1 Complete** ✅  
API contracts defined and documented.




