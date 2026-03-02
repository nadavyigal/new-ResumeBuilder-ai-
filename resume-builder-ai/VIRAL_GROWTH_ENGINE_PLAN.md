# Implementation Plan: Free ATS Score Checker (Viral Growth Engine)

## Objective
Transform the landing page into a free ATS score checker that allows users to check their resume's ATS score WITHOUT requiring signup, then convert them through a freemium funnel with viral sharing mechanics.

## Status
✅ **Phase 1: Exploration** - Complete
✅ **Phase 2: Design** - Complete
✅ **Phase 3: User Decisions** - Complete
📝 **Phase 4: Final Plan** - Ready for review

---

## User Decisions
- **Landing Page**: Replace hero completely with ATS checker (maximum prominence)
- **Data Storage**: Hash-only approach (GDPR-friendly, no full resume text stored)
- **Rate Limiting**: 5 checks per 7 days (flexible for legitimate job seekers)
- **Conversion Flow**: Auto-create full optimization after signup (seamless UX)

---

## Phase 1 Findings

### Current Landing Page
- **Location:** `src/app/page.tsx`
- **Components:** HeroSection, FeaturesBento, HowItWorks
- **Current CTA:** "Start Free Optimization" → redirects to `/auth/signup` (requires auth)
- **File Upload:** Exists at `src/app/dashboard/resume/page.tsx` (authenticated only)
- **Upload API:** `/api/upload-resume` (requires authentication)

### ATS Scoring Engine
- **Entry Points:** `/api/ats/score` and `@/lib/ats` direct import
- **Architecture:** 8-dimension scoring (keyword_exact 22%, semantic 16%, format 14%, etc.)
- **Performance:** 3-5 seconds typical (includes OpenAI embeddings)
- **Caching:** In-memory LRU cache with 60min TTL
- **Minimum Input:** Resume text + job description text (JD structure can be auto-extracted)
- **Output:** Score (0-100), 8 subscores, suggestions array, confidence

### Authentication & Database
- **Auth:** Supabase Auth with email/password
- **RLS:** Enabled on all tables (user_id based)
- **Current Issue:** NO support for anonymous users - all endpoints require auth
- **Rate Limiting:** In-memory, per-user-ID only (no IP-based limiting)
- **Tables:** profiles, resumes, job_descriptions, optimizations, chat_sessions, templates

### Critical Gaps
1. ❌ No anonymous session tracking mechanism
2. ❌ No public API endpoint for scoring without auth
3. ❌ No database table for anonymous scores
4. ❌ No IP-based rate limiting (only user-ID based)
5. ❌ No linkage strategy from anonymous → authenticated user

---

## Implementation Plan

### Overview
Transform landing page hero section into free ATS score checker allowing anonymous scoring, then convert users through auto-optimization creation.

**Timeline**: 2-3 days
**Complexity**: Medium (new anonymous user architecture)

---

## Phase 1: Database & Backend (Day 1 - 6 hours)

### 1.1 Database Migration
**File**: `supabase/migrations/YYYYMMDD_add_anonymous_scoring.sql`

Create two new tables:

```sql
-- Store anonymous score metadata (NOT full resume)
CREATE TABLE public.anonymous_ats_scores (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,

  -- Score results
  ats_score INTEGER NOT NULL,
  ats_subscores JSONB NOT NULL,
  ats_suggestions JSONB NOT NULL,  -- All suggestions, frontend shows 3

  -- Deduplication (hash of resume content)
  resume_hash TEXT NOT NULL,
  job_description_hash TEXT NOT NULL,

  -- Conversion tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  optimization_id BIGINT REFERENCES optimizations(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Cleanup
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_anon_scores_session ON anonymous_ats_scores(session_id);
CREATE INDEX idx_anon_scores_ip ON anonymous_ats_scores(ip_address, created_at);
CREATE INDEX idx_anon_scores_expiry ON anonymous_ats_scores(expires_at);
CREATE INDEX idx_anon_scores_user ON anonymous_ats_scores(user_id) WHERE user_id IS NOT NULL;

-- Rate limiting table
CREATE TABLE public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,  -- IP or session ID
  endpoint TEXT NOT NULL,
  requests_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rate_limits_unique UNIQUE (identifier, endpoint)
);

CREATE INDEX idx_rate_limits_lookup ON rate_limits(identifier, endpoint, window_start);
```

**RLS Policies**:
```sql
-- Allow anonymous inserts for scoring
ALTER TABLE anonymous_ats_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON anonymous_ats_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view converted scores" ON anonymous_ats_scores
  FOR SELECT USING (user_id = auth.uid());

-- Rate limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage rate limits" ON rate_limits FOR ALL USING (true);
```

### 1.2 Rate Limiting Library
**File**: `src/lib/rate-limiting/check-rate-limit.ts`

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult>
```

**Implementation**:
- Query `rate_limits` table for identifier + endpoint
- Check if within window (created_at + windowMs)
- If window expired, reset counter
- If count >= maxRequests, deny
- Otherwise increment and allow
- Use Supabase transaction for atomic update

**File**: `src/lib/rate-limiting/get-client-ip.ts`

```typescript
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  );
}
```

### 1.3 Public ATS Check API
**File**: `src/app/api/public/ats-check/route.ts`

**Request**: FormData with resume file + job description text
**Response**: Score + top 3 issues + session ID

```typescript
export async function POST(request: Request) {
  // 1. Extract IP and generate/retrieve session ID
  const ip = getClientIP(request);
  const sessionId = request.headers.get('x-session-id') || crypto.randomUUID();

  // 2. Check rate limit (5 requests per 7 days)
  const rateLimit = await checkRateLimit(
    ip,
    'ats-check',
    { maxRequests: 5, windowMs: 7 * 24 * 60 * 60 * 1000 }
  );

  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: 'Rate limit exceeded',
      resetAt: rateLimit.resetAt
    }, { status: 429 });
  }

  // 3. Parse request (resume file + job description)
  const formData = await request.formData();
  const file = formData.get('resume') as File;
  const jobDescription = formData.get('jobDescription') as string;

  // 4. Validate inputs
  if (!file || file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }

  // 5. Parse resume (reuse existing parser)
  const buffer = Buffer.from(await file.arrayBuffer());
  const resumeText = await parsePdf(buffer);

  // 6. Calculate hashes (for deduplication)
  const resumeHash = hashContent(resumeText);
  const jobHash = hashContent(jobDescription);

  // 7. Check for duplicate (return cached if within 1 hour)
  const cached = await supabase
    .from('anonymous_ats_scores')
    .select('*')
    .eq('session_id', sessionId)
    .eq('resume_hash', resumeHash)
    .eq('job_description_hash', jobHash)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000))
    .maybeSingle();

  if (cached.data) {
    return NextResponse.json(formatResponse(cached.data, sessionId));
  }

  // 8. Score with ATS engine (reuse existing)
  const scoreResult = await scoreResume({
    resume_original_text: resumeText,
    resume_optimized_text: resumeText,  // Same for anonymous check
    job_clean_text: jobDescription
  });

  // 9. Store anonymous score (hash only, NOT full text)
  const { data: score } = await supabase
    .from('anonymous_ats_scores')
    .insert({
      session_id: sessionId,
      ip_address: ip,
      ats_score: scoreResult.ats_score_optimized,
      ats_subscores: scoreResult.subscores,
      ats_suggestions: scoreResult.suggestions,
      resume_hash: resumeHash,
      job_description_hash: jobHash
    })
    .select()
    .single();

  // 10. Return preview (top 3 issues only)
  return NextResponse.json(formatResponse(score, sessionId));
}

function formatResponse(score: any, sessionId: string) {
  return {
    success: true,
    sessionId,
    score: {
      overall: score.ats_score,
      timestamp: score.created_at
    },
    preview: {
      topIssues: score.ats_suggestions.slice(0, 3),
      totalIssues: score.ats_suggestions.length,
      lockedCount: score.ats_suggestions.length - 3
    },
    checksRemaining: /* calculate from rate limit */
  };
}
```

### 1.4 Session Conversion API
**File**: `src/app/api/public/convert-session/route.ts`

**Purpose**: Link anonymous session to user account, create full optimization

```typescript
export async function POST(request: Request) {
  // 1. Authenticate user (REQUIRED)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get session ID from request
  const { sessionId } = await request.json();

  // 3. Find most recent anonymous score for this session
  const { data: anonScore } = await supabase
    .from('anonymous_ats_scores')
    .select('*')
    .eq('session_id', sessionId)
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anonScore) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // 4. User must re-upload resume (we only stored hash)
  // This endpoint just marks the session as converted
  // Actual optimization creation happens in upload-resume API

  // 5. Update anonymous score with user_id
  await supabase
    .from('anonymous_ats_scores')
    .update({
      user_id: user.id,
      converted_at: new Date().toISOString()
    })
    .eq('id', anonScore.id);

  // 6. Return score data for frontend to pre-fill
  return NextResponse.json({
    success: true,
    scoreData: {
      score: anonScore.ats_score,
      suggestions: anonScore.ats_suggestions
    }
  });
}
```

---

## Phase 2: Frontend Components (Day 1-2 - 8 hours)

### 2.1 Free ATS Checker Component
**File**: `src/components/landing/free-ats-checker.tsx`

**Replaces**: Entire hero section in `src/app/page.tsx`

```typescript
'use client'

export function FreeATSChecker() {
  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);

  useEffect(() => {
    // Get or create session ID
    const stored = localStorage.getItem('ats_session_id');
    if (!stored) {
      const newId = crypto.randomUUID();
      localStorage.setItem('ats_session_id', newId);
      setSessionId(newId);
    } else {
      setSessionId(stored);
    }
  }, []);

  async function handleSubmit(file: File, jobDescription: string) {
    setStep('processing');

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobDescription', jobDescription);

    const response = await fetch('/api/public/ats-check', {
      method: 'POST',
      headers: { 'x-session-id': sessionId },
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      setScoreData(data);
      setStep('results');
    } else if (response.status === 429) {
      // Rate limited
      const data = await response.json();
      setRateLimited(true);
      setResetAt(data.resetAt);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {step === 'upload' && <UploadForm onSubmit={handleSubmit} />}
      {step === 'processing' && <LoadingState />}
      {step === 'results' && <ScoreDisplay data={scoreData} />}
    </div>
  );
}
```

**Sub-components**:
- `UploadForm`: Drag-drop file + job description textarea
- `LoadingState`: Progress indicator with messaging (3-5 seconds)
- `ScoreDisplay`: Score + top 3 issues + blurred overlay

### 2.2 Score Display Component
**File**: `src/components/landing/ats-score-display.tsx`

```typescript
export function ATSScoreDisplay({ data }: { data: ScoreData }) {
  const { score, preview } = data;

  return (
    <div className="space-y-6">
      {/* Animated score */}
      <div className="text-center">
        <div className="text-6xl font-bold">
          <CountUp end={score.overall} duration={2} />
          <span className="text-3xl text-muted-foreground">/100</span>
        </div>
        <ScoreBadge score={score.overall} />
      </div>

      {/* Top 3 issues */}
      <div className="space-y-3">
        <h3 className="font-semibold">Top Critical Issues:</h3>
        {preview.topIssues.map((issue, i) => (
          <IssueCard key={i} issue={issue} rank={i + 1} />
        ))}
      </div>

      {/* Locked issues (blurred) */}
      <div className="relative">
        <div className="blur-sm opacity-50 pointer-events-none">
          <div className="space-y-2">
            {Array(preview.lockedCount).fill(0).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Card className="p-6 text-center max-w-sm">
            <Lock className="mx-auto h-12 w-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {preview.lockedCount} More Issues
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign up FREE to see all issues + get AI-powered fixes
            </p>
            <Button size="lg" onClick={handleSignup}>
              Sign Up Free
            </Button>
          </Card>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex gap-3 justify-center">
        <ShareButton platform="linkedin" score={score.overall} />
        <ShareButton platform="twitter" score={score.overall} />
      </div>
    </div>
  );
}
```

### 2.3 Social Share Component
**File**: `src/components/landing/social-share-button.tsx`

```typescript
export function ShareButton({ platform, score }: Props) {
  const text = platform === 'linkedin'
    ? `I just checked my resume's ATS score - got ${score}/100! Check yours free at ${window.location.origin}`
    : `My resume scored ${score}/100 on ATS compatibility. What's yours? Check free 👉 ${window.location.origin}`;

  const url = platform === 'linkedin'
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&summary=${encodeURIComponent(text)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  function handleShare() {
    window.open(url, '_blank', 'width=600,height=400');

    // Track event
    posthog.capture('ats_checker_share_clicked', {
      platform,
      score
    });
  }

  return (
    <Button variant="outline" onClick={handleShare}>
      <LinkedInIcon /> Share on {platform}
    </Button>
  );
}
```

### 2.4 Landing Page Integration
**File**: `src/app/page.tsx`

**Change**: Replace `<HeroSection />` with `<FreeATSChecker />`

```typescript
export default function LandingPage() {
  return (
    <main>
      <FreeATSChecker />  {/* REPLACED hero */}
      <FeaturesBento />
      <HowItWorks />
    </main>
  );
}
```

---

## Phase 3: Conversion Flow (Day 2 - 4 hours)

### 3.1 Auth Callback Enhancement
**File**: `src/app/auth/callback/route.ts`

**Add**: Check for session_id param and convert if present

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const sessionId = searchParams.get('session_id');  // NEW

  if (code) {
    const supabase = await createServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    // NEW: Convert anonymous session if present
    if (sessionId) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/public/convert-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

### 3.2 Signup Flow Enhancement
**File**: `src/components/auth/auth-form.tsx`

**Add**: Pass session_id as redirect param

```typescript
function handleSignup() {
  const sessionId = localStorage.getItem('ats_session_id');
  const redirectUrl = sessionId
    ? `/auth/callback?session_id=${sessionId}`
    : '/auth/callback';

  // Existing signup logic with enhanced redirect
}
```

### 3.3 Dashboard Welcome Flow
**File**: `src/app/dashboard/page.tsx`

**Add**: Check for converted session and show welcome message

```typescript
export default async function DashboardPage() {
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user just converted from anonymous
  const { data: convertedScore } = await supabase
    .from('anonymous_ats_scores')
    .select('*')
    .eq('user_id', user.id)
    .not('converted_at', 'is', null)
    .order('converted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convertedScore) {
    return (
      <div>
        <Alert>
          <CheckCircle />
          <AlertTitle>Welcome! Your score: {convertedScore.ats_score}/100</AlertTitle>
          <AlertDescription>
            Now let's create a full optimization to unlock all {convertedScore.ats_suggestions.length} improvements!
          </AlertDescription>
        </Alert>

        <Button onClick={() => router.push('/dashboard/resume')}>
          Upload Resume for Full Optimization
        </Button>
      </div>
    );
  }

  // Regular dashboard
}
```

---

## Phase 4: Polish & Analytics (Day 3 - 4 hours)

### 4.1 Rate Limit UX
**File**: `src/components/landing/rate-limit-message.tsx`

```typescript
export function RateLimitMessage({ resetAt }: { resetAt: Date }) {
  const timeUntilReset = formatDistance(resetAt, new Date());

  return (
    <Card className="p-6 text-center max-w-md mx-auto">
      <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-orange-500" />
      <h3 className="text-xl font-bold mb-2">
        You've used your 5 free checks this week
      </h3>
      <p className="text-muted-foreground mb-4">
        Resets in {timeUntilReset}, or sign up for unlimited checks + AI-powered fixes!
      </p>
      <Button size="lg" onClick={() => router.push('/auth/signup')}>
        Sign Up Free
      </Button>
    </Card>
  );
}
```

### 4.2 PostHog Analytics
**File**: Various components

**Events to track**:

```typescript
// Landing page
posthog.capture('ats_checker_view')
posthog.capture('ats_checker_file_uploaded', { fileSize, fileType })
posthog.capture('ats_checker_submitted', { hasJobUrl })

// Results
posthog.capture('ats_checker_score_displayed', {
  score,
  totalIssues,
  sessionId
})

// Conversion
posthog.capture('ats_checker_share_clicked', { platform, score })
posthog.capture('ats_checker_signup_clicked', { score, sessionId })
posthog.capture('ats_checker_session_converted', {
  sessionId,
  userId,
  score,
  timeSinceCheck
})

// Rate limiting
posthog.capture('ats_checker_rate_limited', { checksUsed: 5 })
```

### 4.3 Error Handling
**File**: All API routes and components

**Errors to handle**:
- Resume parsing failure → "We couldn't read your resume. Try converting to PDF."
- ATS timeout → "Scoring is taking longer than usual. Please try again."
- Job description too short → "Please paste the full job description (at least 100 words)."
- Network errors → "Connection error. Please check your internet and try again."

---

## File Summary

### New Files to Create (15 files)

**Database**:
1. `supabase/migrations/YYYYMMDD_add_anonymous_scoring.sql` - Schema for anonymous scores & rate limits

**Backend**:
2. `src/lib/rate-limiting/check-rate-limit.ts` - Rate limiting logic
3. `src/lib/rate-limiting/get-client-ip.ts` - IP extraction utility
4. `src/lib/utils/hash-content.ts` - Content hashing for deduplication
5. `src/app/api/public/ats-check/route.ts` - Public ATS scoring endpoint
6. `src/app/api/public/convert-session/route.ts` - Session conversion endpoint

**Frontend**:
7. `src/components/landing/free-ats-checker.tsx` - Main checker component
8. `src/components/landing/ats-score-display.tsx` - Score results display
9. `src/components/landing/upload-form.tsx` - File upload + job description form
10. `src/components/landing/loading-state.tsx` - Processing indicator
11. `src/components/landing/issue-card.tsx` - Individual issue display
12. `src/components/landing/social-share-button.tsx` - Share buttons
13. `src/components/landing/rate-limit-message.tsx` - Rate limit UI
14. `src/components/ui/count-up.tsx` - Animated number counter
15. `src/lib/utils/format-distance.ts` - Date formatting utility

### Files to Modify (4 files)

1. `src/app/page.tsx` - Replace hero with FreeATSChecker
2. `src/app/auth/callback/route.ts` - Add session conversion on signup
3. `src/components/auth/auth-form.tsx` - Pass session_id in redirect
4. `src/app/dashboard/page.tsx` - Show converted score welcome

---

## Implementation Sequence

**Day 1 Morning (3 hours)**:
1. Database migration
2. Rate limiting library
3. IP extraction utility

**Day 1 Afternoon (3 hours)**:
4. Public ATS check API
5. Session conversion API

**Day 2 Morning (4 hours)**:
6. Upload form component
7. Free ATS checker main component
8. Loading state component

**Day 2 Afternoon (4 hours)**:
9. Score display component
10. Issue card component
11. Social share buttons
12. Landing page integration

**Day 3 Morning (2 hours)**:
13. Auth callback enhancement
14. Signup flow enhancement
15. Dashboard welcome flow

**Day 3 Afternoon (2 hours)**:
16. Rate limit message UI
17. Error handling
18. PostHog analytics
19. Testing & polish

---

## Testing Checklist

- [ ] Anonymous score check (no login)
- [ ] Score display shows 3 issues, hides rest
- [ ] Share buttons generate correct URLs
- [ ] Rate limiting works (5 per week)
- [ ] Rate limit message appears correctly
- [ ] Signup from checker works
- [ ] Session conversion creates optimization
- [ ] Dashboard shows converted score
- [ ] Mobile responsive design
- [ ] Error states (parsing, timeout, network)

---

## Success Metrics

**Week 1 Targets**:
- 100+ anonymous score checks
- 20%+ conversion rate (check → signup)
- 10%+ share rate
- <5s average scoring time

**Month 1 Targets**:
- 2,000+ anonymous checks
- 500+ signups from checker
- 0.4+ viral coefficient (K-factor)

---
