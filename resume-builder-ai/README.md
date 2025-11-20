# Resume Builder AI - Developer Documentation

An AI-powered resume optimization platform built with Next.js, Supabase, and OpenAI.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [API Routes](#api-routes)
- [Key Features](#key-features)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Overview

Resume Builder AI helps users optimize their resumes for specific job descriptions using AI. The Enhanced AI Assistant (Phase 7) includes:

- **Smart Content Modifications**: Field-specific resume updates
- **Visual Customization**: Real-time color and font changes
- **ATS Scoring**: Automatic resume scoring and optimization
- **PDF Export**: Custom-styled resume downloads

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **State**: React hooks (no external state library)

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **AI**: OpenAI API (GPT-4)
- **PDF Generation**: Puppeteer

### Infrastructure
- **Hosting**: Vercel (recommended)
- **Database**: Supabase
- **Monitoring**: (configure as needed)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd resume-builder-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create `.env.local`:
   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # OpenAI
   OPENAI_API_KEY=your_openai_api_key

   # App Config
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NODE_ENV=development
   LOG_LEVEL=debug

   # Optional: Stripe (for payments)
   STRIPE_SECRET_KEY=your_stripe_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   ```

4. **Set up database**
   ```bash
   # Initialize Supabase locally (optional)
   npx supabase init

   # Or connect to remote Supabase
   npx supabase link --project-ref your-project-ref

   # Apply migrations
   npx supabase db push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

### Directory Structure

```
resume-builder-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── v1/            # API v1
│   │   │       ├── chat/              # AI chat endpoint
│   │   │       ├── modifications/     # Content modifications
│   │   │       ├── styles/            # Visual customization
│   │   │       └── ...
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Main app
│   │   └── ...
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   └── ...
│   ├── lib/                  # Utilities and core logic
│   │   ├── agent/            # AI agent logic
│   │   │   ├── handlers/             # Intent handlers
│   │   │   ├── utils/                # Logger, helpers
│   │   │   ├── intents.ts            # Intent detection
│   │   │   └── ...
│   │   ├── middleware/       # Error handling, rate limiting
│   │   ├── queue/            # AI request queue
│   │   ├── resume/           # Resume operations
│   │   ├── ats/              # ATS scoring
│   │   └── supabase.ts       # Supabase client
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # Database migrations
├── tests/
│   ├── e2e/                  # Playwright E2E tests
│   ├── integration/          # Integration tests
│   ├── lib/                  # Unit tests
│   └── fixtures/             # Test data
├── docs/                     # Documentation
└── public/                   # Static assets
```

### Data Flow

```
User Request
    ↓
API Route (/api/v1/*)
    ↓
Rate Limiting → Error Handling
    ↓
Authentication Check
    ↓
Request Queue (for AI operations)
    ↓
Business Logic (lib/)
    ├─→ AI Agent (OpenAI)
    ├─→ Database (Supabase)
    └─→ File Storage
    ↓
Response (JSON)
    ↓
Client (React)
```

---

## API Routes

### Core Endpoints

#### Chat (AI Assistant)
- `POST /api/v1/chat` - Send message to AI assistant
  - Request: `{ message, optimizationId, sessionId }`
  - Response: Streaming or JSON with AI response

#### Modifications
- `POST /api/v1/modifications/apply` - Apply content modification
- `GET /api/v1/modifications/history` - Get modification history
- `POST /api/v1/modifications/[id]/revert` - Revert modification

#### Styles
- `GET /api/v1/styles/history` - Get style history
- `POST /api/v1/styles/validate` - Validate color/font combination
- `POST /api/v1/styles/revert` - Revert to previous style

### Authentication

All API routes require authentication via Supabase Auth:

```typescript
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ... rest of handler
}
```

### Rate Limiting

Apply rate limiting to endpoints:

```typescript
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const POST = withRateLimit(
  async (request) => {
    // Handler logic
  },
  RATE_LIMITS.modifications // 30 req/min
);
```

### Error Handling

Use centralized error handling:

```typescript
import { withErrorHandler, NotFoundError } from '@/lib/middleware/error-handler';

export const GET = withErrorHandler(async (request) => {
  const resource = await db.find(id);

  if (!resource) {
    throw new NotFoundError('Resource');
  }

  return NextResponse.json(resource);
});
```

---

## Key Features

### 1. Smart Content Modifications

**Location**: `src/lib/resume/`

- **Field Path Resolver** (`field-path-resolver.ts`): Parse and navigate resume JSON
- **Modification Applier** (`modification-applier.ts`): Apply operations (replace, prefix, append, etc.)
- **Modification Parser** (`src/lib/ai-assistant/modification-parser.ts`): Convert natural language to modifications

**Usage**:
```typescript
import { applyModification } from '@/lib/resume/modification-applier';

const updated = await applyModification(resume, {
  operation: 'prefix',
  targetPath: 'experiences[0].title',
  value: 'Senior ',
});
```

### 2. Visual Customization

**Location**: `src/lib/agent/`

- **Color Parsing** (`parseColorRequest.ts`): 80+ color names to hex
- **Accessibility Validator** (`accessibilityValidator.ts`): WCAG AA/AAA contrast checking
- **Font Validator** (`fontValidator.ts`): Professional font validation

**Usage**:
```typescript
import { parseColorRequest } from '@/lib/agent/parseColorRequest';

const colors = parseColorRequest('navy blue background with white text');
// [{ target: 'background', color: '#001f3f', ...}, ...]
```

### 3. AI Request Queue

**Location**: `src/lib/queue/ai-request-queue.ts`

Prevents overwhelming OpenAI API with concurrent requests:

```typescript
import { enqueueAIRequest, PRIORITIES } from '@/lib/queue/ai-request-queue';

const response = await enqueueAIRequest(
  () => openai.chat.completions.create({ ... }),
  PRIORITIES.HIGH,
  30000 // 30s timeout
);
```

### 4. Structured Logging

**Location**: `src/lib/agent/utils/logger.ts`

PII-redacted, structured logging:

```typescript
import { createLogger } from '@/lib/agent/utils/logger';

const logger = createLogger({ userId: '123', endpoint: '/api/chat' });

logger.info('Processing request');
logger.error('Request failed', { reason: 'timeout' }, error);
logger.performance('AI generation', 2500); // ms
```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Testing
npm run test             # Run Jest tests
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:debug   # Debug E2E tests

# Database
npx supabase db reset    # Reset database
npx supabase db push     # Apply migrations
npx supabase migration new <name>  # Create migration

# Utilities
npm run sync-templates   # Sync external resume templates
```

### Code Style

- **TypeScript** strict mode enabled
- **ESLint** for linting
- **Prettier** recommended for formatting
- **Naming conventions**:
  - Components: `PascalCase`
  - Utilities: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts`

### Adding a New API Route

1. Create file in `src/app/api/v1/<endpoint>/route.ts`
2. Add error handling wrapper
3. Add rate limiting
4. Add authentication check
5. Implement business logic
6. Add tests

**Template**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit';
import { createClient } from '@/lib/supabase-server';

const handler = async (request: NextRequest) => {
  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  // Business logic
  const body = await request.json();
  // ...

  return NextResponse.json({ success: true });
};

export const POST = withRateLimit(
  withErrorHandler(handler),
  RATE_LIMITS.default
);
```

---

## Testing

### Unit Tests (Jest)

```bash
npm run test              # All tests
npm run test -- --watch   # Watch mode
npm run test -- <pattern> # Specific tests
```

**Example**:
```typescript
import { applyModification } from '@/lib/resume/modification-applier';

describe('applyModification', () => {
  it('should prefix job title', () => {
    const resume = { experiences: [{ title: 'Engineer' }] };
    const result = applyModification(resume, {
      operation: 'prefix',
      targetPath: 'experiences[0].title',
      value: 'Senior ',
    });

    expect(result.experiences[0].title).toBe('Senior Engineer');
  });
});
```

### E2E Tests (Playwright)

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Interactive mode
npm run test:e2e:debug    # Debug mode
```

See [tests/e2e/README.md](tests/e2e/README.md) for detailed E2E testing guide.

---

## Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - automatic on push to main

### Manual Deployment

```bash
npm run build
npm run start
```

### Database Migrations

Apply migrations before deploying:

```bash
npx supabase db push
```

### Monitoring

- **Error tracking**: Configure Sentry or similar
- **Performance**: Vercel Analytics
- **Logs**: Vercel logs or external service

---

## Additional Resources

- **User Guide**: [docs/ai-assistant-guide.md](docs/ai-assistant-guide.md)
- **API Contracts**: [specs/improvements/contracts/](../specs/improvements/contracts/)
- **E2E Test Guide**: [tests/e2e/README.md](tests/e2e/README.md)
- **Phase 6 Completion**: [specs/improvements/PHASE_6_COMPLETE.md](../specs/improvements/PHASE_6_COMPLETE.md)

---

## Support

- **Issues**: GitHub Issues
- **Email**: dev@resumebuilder.ai
- **Docs**: https://docs.resumebuilder.ai

---

**Last Updated**: 2025-01-19
**Version**: 2.0 (Enhanced AI Assistant - Phase 7)
