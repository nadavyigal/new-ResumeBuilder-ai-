# ATS Per-Keyword In-Context Suggestions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fabricated "Score signals" bars and bundled keyword suggestion with real diagnostic data, and let the user approve/reject each missing keyword individually with its proposed in-context placement on the resume (e.g. weaving "market research" into an existing bullet, not dumping it into a skills list).

**Architecture:** Three sequential sub-phases across two repos:
- **Phase A (web):** wire the already-computed `ats_suggestions` into the optimization-detail API response as `ats_blockers`, so the iOS app's existing `ATSOptimizationBlocker` decoding gets real data instead of nothing.
- **Phase B (web):** split the single bundled `keyword_exact` suggestion into one suggestion per missing keyword, and add a preview endpoint that calls the existing (currently-uncalled) `generateAmendments()` AI function to compute a specific before/after bullet rewrite for one keyword at a time.
- **Phase C (iOS):** add a card to the existing optimized-resume screen listing each missing keyword; tapping one fetches its in-context preview, and Approve/Reject reuses the existing `/api/v1/chat/approve-change` flow that's already fully wired end-to-end.

Each phase produces working, independently testable software — Phase A alone fixes the fabricated bars even with zero other changes; Phase B alone is testable via direct API calls; Phase C is the only phase requiring a device/simulator.

**Tech Stack:** Next.js 14 (TypeScript) + Supabase + OpenAI on the web side; SwiftUI + `@Observable` view models on the iOS side. Jest for web unit tests (`npm test`).

**Repos:**
- Web: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`
- iOS: `/Users/nadavyigal/Documents/Projects /ResumeBuilder/ResumeBuilder IOS APP/ResumeBuilder IOS APP` (note the nested `ResumeBuilder IOS APP/ResumeBuilder IOS APP/` directory layer — Xcode project root is the inner one)

---

## Phase A — Stop fabricating the "Score signals" bars

### Task A1: Map ATS suggestions to the `ats_blockers` shape iOS already expects

**Why this works without any iOS change first:** iOS's `ATSOptimizationBlocker` decoder (`Core/API/Models/DomainModels.swift:1731-1743`) already tolerantly accepts keys like `title`/`label`/`message`, `detail`/`description`/`rationale`/`text`, `suggested_action`, `estimated_gain`, `severity`. We only need the web GET route to start sending an `ats_blockers` array — no iOS decoding changes needed for this task.

**Files:**
- Modify: `src/app/api/v1/optimizations/[id]/route.ts:150-191`
- Test: `src/lib/ats/__tests__/blocker-mapper.test.ts` (new)
- Create: `src/lib/ats/blocker-mapper.ts` (new — pure function, kept out of the route file so it's unit-testable without mocking Supabase)

- [ ] **Step 1: Write the failing test for the pure mapping function**

```typescript
// src/lib/ats/__tests__/blocker-mapper.test.ts
import { mapSuggestionsToBlockers } from '../blocker-mapper';
import type { Suggestion } from '../types';

describe('mapSuggestionsToBlockers', () => {
  it('maps a Suggestion into the iOS ATSOptimizationBlocker shape', () => {
    const suggestions: Suggestion[] = [
      {
        id: 'keyword_exact:market-research',
        text: 'Add "market research" in context',
        estimated_gain: 6,
        targets: ['keyword_exact'],
        quick_win: true,
        category: 'keywords',
        action: {
          type: 'add_keyword',
          params: { keywords: ['market research'], target: 'experience', source: 'must_have' },
        },
      },
    ];

    const blockers = mapSuggestionsToBlockers(suggestions);

    expect(blockers).toEqual([
      {
        id: 'keyword_exact:market-research',
        category: 'keywords',
        title: 'Add "market research" in context',
        detail: 'Add "market research" in context',
        suggested_action: 'Add "market research" in context',
        estimated_gain: 6,
        severity: 'high',
      },
    ]);
  });

  it('derives severity from estimated_gain (>=10 high, >=5 medium, else low)', () => {
    const make = (gain: number): Suggestion => ({
      id: `s-${gain}`,
      text: 'x',
      estimated_gain: gain,
      targets: ['keyword_exact'],
      quick_win: false,
      category: 'keywords',
    });

    const blockers = mapSuggestionsToBlockers([make(12), make(7), make(2)]);

    expect(blockers.map((b) => b.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('returns an empty array for an empty or undefined suggestion list', () => {
    expect(mapSuggestionsToBlockers([])).toEqual([]);
    expect(mapSuggestionsToBlockers(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/ats/__tests__/blocker-mapper.test.ts`
Expected: FAIL with `Cannot find module '../blocker-mapper'`

- [ ] **Step 3: Implement `mapSuggestionsToBlockers`**

```typescript
// src/lib/ats/blocker-mapper.ts
import type { Suggestion } from './types';

export interface ATSBlockerDTO {
  id: string;
  category: string;
  title: string;
  detail: string;
  suggested_action: string;
  estimated_gain: number;
  severity: 'high' | 'medium' | 'low';
}

function severityFromGain(gain: number): 'high' | 'medium' | 'low' {
  if (gain >= 10) return 'high';
  if (gain >= 5) return 'medium';
  return 'low';
}

/**
 * Converts ATS suggestions (already computed by the scorer) into the
 * flat blocker shape the iOS app's `ATSOptimizationBlocker` decoder expects.
 */
export function mapSuggestionsToBlockers(
  suggestions: Suggestion[] | undefined | null
): ATSBlockerDTO[] {
  if (!suggestions || suggestions.length === 0) return [];

  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    category: suggestion.category,
    title: suggestion.text,
    detail: suggestion.text,
    suggested_action: suggestion.text,
    estimated_gain: suggestion.estimated_gain,
    severity: severityFromGain(suggestion.estimated_gain),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/ats/__tests__/blocker-mapper.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the mapper into the GET route**

In `src/app/api/v1/optimizations/[id]/route.ts`, change the `.select()` call and the JSON response.

Replace:
```typescript
  const { data: row, error: rowErr } = await supabase
    .from("optimizations")
    .select("rewrite_data, ats_score_original, ats_score_optimized, jd_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
```
with:
```typescript
  const { data: row, error: rowErr } = await supabase
    .from("optimizations")
    .select("rewrite_data, ats_score_original, ats_score_optimized, jd_id, ats_suggestions")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
```

Add the import at the top of the file (alongside the existing imports):
```typescript
import { mapSuggestionsToBlockers } from "@/lib/ats/blocker-mapper";
import type { Suggestion } from "@/lib/ats/types";
```

Replace the final `return NextResponse.json({...})` block:
```typescript
  return NextResponse.json({
    sections,
    contact,
    jobTitle,
    job_title: jobTitle,
    company,
    atsScoreBefore: toIntPercent(row.ats_score_original),
    ats_score_before: toIntPercent(row.ats_score_original),
    atsScoreAfter: toIntPercent(row.ats_score_optimized),
    ats_score_after: toIntPercent(row.ats_score_optimized),
  });
```
with:
```typescript
  const blockers = mapSuggestionsToBlockers(row.ats_suggestions as Suggestion[] | null);

  return NextResponse.json({
    sections,
    contact,
    jobTitle,
    job_title: jobTitle,
    company,
    atsScoreBefore: toIntPercent(row.ats_score_original),
    ats_score_before: toIntPercent(row.ats_score_original),
    atsScoreAfter: toIntPercent(row.ats_score_optimized),
    ats_score_after: toIntPercent(row.ats_score_optimized),
    atsBlockers: blockers,
    ats_blockers: blockers,
  });
```

- [ ] **Step 6: Manually verify against a real optimization row**

Run (replace `<OPT_ID>` and `<TOKEN>` with a real optimization id and a valid bearer token from a logged-in session — get the token from the iOS app's network logs or a browser devtools request to the same route):

```bash
curl -s "http://localhost:3000/api/v1/optimizations/<OPT_ID>" \
  -H "Authorization: Bearer <TOKEN>" | jq '.ats_blockers'
```

Expected: a non-empty JSON array (assuming the optimization has `ats_suggestions` stored — if it's `[]`, the optimization was created before suggestions were persisted; test against a freshly-optimized one).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ats/blocker-mapper.ts src/lib/ats/__tests__/blocker-mapper.test.ts src/app/api/v1/optimizations/\[id\]/route.ts
git commit -m "feat(ats): expose ats_blockers in optimization detail response"
```

---

## Phase B — Split the bundled keyword suggestion and compute in-context placement

### Task B1: Split the single `keyword_exact` suggestion into one suggestion per keyword

**Current behavior:** `createSuggestion()` in `src/lib/ats/suggestions/generator.ts:110-145` builds exactly one `Suggestion` per subscore template, and for `keyword_exact` that suggestion's `action.params.keywords` bundles up to 5 keywords together (see `selectKeywordCandidates`, `generator.ts:314-339`). We need one `Suggestion` per keyword instead, so each can be approved independently.

**Files:**
- Modify: `src/lib/ats/suggestions/generator.ts:23-73` (the `generateSuggestions` export)
- Test: `src/lib/ats/suggestions/__tests__/generator.test.ts` (new)

- [ ] **Step 1: Read the current `generateSuggestions` export to confirm the exact insertion point**

Run: `sed -n '23,73p' "src/lib/ats/suggestions/generator.ts"`

Confirm it loops over `identifyGaps(subscores)` and calls `createSuggestion()` once per gap, pushing the result into a `suggestions` array before calling `rankSuggestions(suggestions)`.

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/ats/suggestions/__tests__/generator.test.ts
import { generateSuggestions } from '../generator';
import type { SubScores } from '../../types';

const LOW_SUBSCORES: SubScores = {
  keyword_exact: 30,
  keyword_phrase: 70,
  semantic_relevance: 70,
  format_parseability: 90,
  title_alignment: 80,
  metrics_presence: 80,
  section_completeness: 90,
  recency_fit: 90,
};

describe('generateSuggestions — keyword_exact fan-out', () => {
  it('emits one suggestion per missing must-have keyword, not one bundled suggestion', () => {
    const suggestions = generateSuggestions({
      subscores: LOW_SUBSCORES,
      evidence: {
        keyword_exact: {
          missing: ['market research', 'led negotiations', 'partnership strategy'],
          mustHaveTotal: 6,
          mustHaveMatched: 3,
        },
      },
      jobData: {
        title: 'Head of Partnerships',
        company: '',
        must_have: ['market research', 'led negotiations', 'partnership strategy'],
        nice_to_have: [],
        responsibilities: [],
        seniority: 'senior',
        location: '',
        industry: '',
      },
    });

    const keywordSuggestions = suggestions.filter((s) => s.action?.type === 'add_keyword');

    expect(keywordSuggestions.length).toBe(3);
    keywordSuggestions.forEach((s) => {
      expect(s.action?.type).toBe('add_keyword');
      if (s.action?.type === 'add_keyword') {
        expect(s.action.params.keywords).toHaveLength(1);
      }
    });

    const keywordTexts = keywordSuggestions.map((s) =>
      s.action?.type === 'add_keyword' ? s.action.params.keywords[0] : ''
    );
    expect(keywordTexts.sort()).toEqual(
      ['led negotiations', 'market research', 'partnership strategy'].sort()
    );
  });

  it('gives each split keyword suggestion a unique, stable id', () => {
    const suggestions = generateSuggestions({
      subscores: LOW_SUBSCORES,
      evidence: {
        keyword_exact: { missing: ['market research', 'led negotiations'], mustHaveTotal: 4, mustHaveMatched: 2 },
      },
      jobData: {
        title: 'Head of Partnerships',
        company: '',
        must_have: ['market research', 'led negotiations'],
        nice_to_have: [],
        responsibilities: [],
        seniority: 'senior',
        location: '',
        industry: '',
      },
    });

    const ids = suggestions.filter((s) => s.action?.type === 'add_keyword').map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^keyword_exact:/));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/lib/ats/suggestions/__tests__/generator.test.ts`
Expected: FAIL — the existing code returns one bundled `add_keyword` suggestion with 3 keywords in `params.keywords`, so `keywordSuggestions.length` will be `1`, not `3`.

- [ ] **Step 4: Implement the fan-out in `generateSuggestions`**

Open `src/lib/ats/suggestions/generator.ts`. Find the loop inside `generateSuggestions` (around line 23-73) that calls `createSuggestion(subscore, template, evidence, currentScore, jobData)` and pushes a single result. Replace the push of that one suggestion with a call to a new `expandKeywordSuggestion` helper that fans a bundled `keyword_exact` suggestion into N suggestions, leaving every other subscore untouched.

Add this new function near `createSuggestion` (after its closing brace, around line 145):

```typescript
/**
 * `createSuggestion` bundles every missing keyword for `keyword_exact` into
 * one suggestion's `action.params.keywords` array. Split it into one
 * suggestion per keyword so the UI can offer per-keyword approve/reject —
 * each keyword needs its own in-context placement, not a shared one.
 */
function expandKeywordSuggestion(suggestion: Suggestion): Suggestion[] {
  if (suggestion.action?.type !== 'add_keyword') {
    return [suggestion];
  }

  const { keywords, target, source } = suggestion.action.params;
  if (keywords.length <= 1) {
    return [suggestion];
  }

  const gainPerKeyword = Math.max(1, Math.round(suggestion.estimated_gain / keywords.length));

  return keywords.map((keyword) => ({
    id: `keyword_exact:${slugifyKeyword(keyword)}`,
    text: `Add "${keyword}" in context on your resume`,
    estimated_gain: gainPerKeyword,
    targets: suggestion.targets,
    quick_win: suggestion.quick_win,
    category: suggestion.category,
    action: {
      type: 'add_keyword' as const,
      params: { keywords: [keyword], target, source },
    },
  }));
}

function slugifyKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

Now find the line in `generateSuggestions` that pushes the result of `createSuggestion(...)` (it will look like `if (suggestion) suggestions.push(suggestion);` or similar — confirm the exact text by re-reading the file before editing) and change it to:

```typescript
      if (suggestion) {
        suggestions.push(...expandKeywordSuggestion(suggestion));
      }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/lib/ats/suggestions/__tests__/generator.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full ATS test suite to check for regressions**

Run: `npx jest src/lib/ats`
Expected: all existing tests still pass (the change only affects `keyword_exact` suggestions with more than one keyword; single-keyword and other-subscore suggestions pass through `expandKeywordSuggestion` unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ats/suggestions/generator.ts src/lib/ats/suggestions/__tests__/generator.test.ts
git commit -m "feat(ats): split bundled keyword_exact suggestion into one per keyword"
```

---

### Task B2: Add a preview endpoint that computes the in-context placement for one keyword

**Why a new endpoint:** `generateAmendments()` (`src/lib/ats/amendment-generator.ts`) already does exactly what's needed — it calls OpenAI to map a suggestion onto a specific resume section/bullet with a before/after value — but it currently has zero callers anywhere in `src/app` (confirmed via `grep -rln "generateAmendments" src/app` returning no matches). The existing `/api/v1/chat/approve-change` route only *applies* `affected_fields` it's handed; it never generates them itself. We need a step that generates them so the iOS app can show the user the proposed change before they approve it.

**Files:**
- Create: `src/app/api/v1/optimizations/[id]/suggestions/[suggestionId]/preview/route.ts`
- Test: manual (this route depends on Supabase + OpenAI; no unit test harness exists for routes in this repo — see Task A1's note that DB-backed routes are verified via `curl`, matching the existing pattern in this codebase)

- [ ] **Step 1: Read the full `approve-change` route for the exact suggestion-lookup pattern to reuse**

Run: `sed -n '1,80p' "src/app/api/v1/chat/approve-change/route.ts"`

Confirm: it authenticates via `createRouteHandlerClient()` + `supabase.auth.getUser()`, then loads `optimizations` row by `id` + `user_id`, then finds the suggestion by `id` inside `optimization.ats_suggestions`.

- [ ] **Step 2: Create the preview route**

```typescript
// src/app/api/v1/optimizations/[id]/suggestions/[suggestionId]/preview/route.ts
/**
 * POST /api/v1/optimizations/:id/suggestions/:suggestionId/preview
 *
 * Computes (without applying) the specific resume field change a single
 * ATS suggestion would make, using the AI-powered amendment generator.
 * The iOS app calls this to show the user an in-context before/after
 * preview before they approve a keyword suggestion via
 * /api/v1/chat/approve-change (which applies whatever affected_fields
 * this route returns).
 */
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { generateAmendments } from "@/lib/ats/amendment-generator";
import { resolveJobDescriptionText } from "@/lib/ats/job-data-resolver";
import { extractJobData } from "@/lib/ats/extractors/jd-extractor";
import type { OptimizedResume } from "@/lib/ai-optimizer";
import type { Suggestion } from "@/lib/ats/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> }
) {
  const { id, suggestionId } = await params;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("optimizations")
    .select("rewrite_data, ats_suggestions, jd_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Optimization not found" }, { status: 404 });
  }

  const suggestions = (row.ats_suggestions as Suggestion[]) || [];
  const suggestion = suggestions.find((s) => s.id === suggestionId);

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const resumeContent = (row.rewrite_data as OptimizedResume) || null;
  if (!resumeContent) {
    return NextResponse.json({ error: "Resume content not found" }, { status: 404 });
  }

  let jobDescriptionText = "";
  if (row.jd_id) {
    const resolved = await resolveJobDescriptionText(supabase, row.jd_id);
    jobDescriptionText = resolved?.text || "";
  }

  const result = await generateAmendments(suggestion, resumeContent, {
    jobDescriptionText,
    jobData: jobDescriptionText ? extractJobData(jobDescriptionText) : undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to generate preview" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    suggestion_id: suggestionId,
    affected_fields: result.affectedFields,
  });
}
```

- [ ] **Step 3: Confirm `resolveJobDescriptionText`'s exact signature before relying on it**

Run: `grep -n "export.*function resolveJobDescriptionText" -A 5 "src/lib/ats/job-data-resolver.ts"`

If the signature differs from `(supabase, jdId) => Promise<{text: string} | null>` used above, adjust the call in Step 2 to match the real signature and return shape (read the function body if needed: `sed -n '1,60p' src/lib/ats/job-data-resolver.ts`).

- [ ] **Step 4: Manually verify the route end-to-end**

Run (replace placeholders with a real optimization id, a real suggestion id from that optimization's `ats_blockers` array from Task A1's verification, and a valid token):

```bash
curl -s -X POST \
  "http://localhost:3000/api/v1/optimizations/<OPT_ID>/suggestions/keyword_exact%3Amarket-research/preview" \
  -H "Authorization: Bearer <TOKEN>" | jq
```

Expected: a JSON body like:
```json
{
  "suggestion_id": "keyword_exact:market-research",
  "affected_fields": [
    {
      "sectionId": "experience-0",
      "field": "achievements",
      "originalValue": ["Conducted competitive analysis of partner ecosystem"],
      "newValue": ["Conducted market research and competitive analysis of partner ecosystem"],
      "changeType": "modify"
    }
  ]
}
```

If `generateAmendments` returns `success: false`, check the OpenAI API key is set (`OPENAI_API_KEY` env var) and check server logs for the underlying error.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/v1/optimizations/[id]/suggestions/[suggestionId]/preview/route.ts"
git commit -m "feat(ats): add per-keyword in-context preview endpoint using amendment generator"
```

---

### Task B3: Verify the existing approve-change route applies previewed fields unchanged

No code change — this task only verifies the existing `/api/v1/chat/approve-change` route (`src/app/api/v1/chat/approve-change/route.ts:353-393`) correctly applies the `affected_fields` array shape Task B2 produces, since that route already accepts caller-supplied `affected_fields` and was built for exactly this purpose.

- [ ] **Step 1: Manually verify approve-change with the preview's output**

Take the `affected_fields` array from Task B2's curl output and POST it to approve-change (replace placeholders):

```bash
curl -s -X POST "http://localhost:3000/api/v1/chat/approve-change" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "optimization_id": "<OPT_ID>",
    "suggestion_id": "keyword_exact:market-research",
    "affected_fields": [
      {
        "sectionId": "experience-0",
        "field": "achievements",
        "newValue": ["Conducted market research and competitive analysis of partner ecosystem"],
        "changeType": "modify"
      }
    ]
  }' | jq
```

Expected: `{"success": true, "updated_resume": {...}}` (or similar) with the experience bullet in `updated_resume` containing the new in-context text. Confirm by re-fetching `GET /api/v1/optimizations/<OPT_ID>` and checking the relevant section's content.

- [ ] **Step 2: If the response doesn't reflect the change, debug before continuing to Phase C**

Check `applyATSSuggestion`'s `sectionId` regex (`route.ts` around line 401: `/^([a-z]+)(?:-(\d+))?$/`) — it expects `experience-0` style ids exactly as `generateAmendments`' prompt instructs the AI to produce (see the system prompt in `amendment-generator.ts`). If the AI returns a different `sectionId` format, this is a prompt-following issue in the AI call, not a code bug — re-run the preview a few times to check consistency, and only file it as a bug to fix if it's systematically wrong.

No commit for this task — it's verification only.

---

## Phase C — iOS: per-keyword approval card

### Task C1: Add the preview-endpoint client call

**Files:**
- Modify: `Core/API/Endpoints.swift`
- Modify: `Core/API/ChatService.swift`

- [ ] **Step 1: Add the new endpoint case**

In `Core/API/Endpoints.swift`, add a case next to `optimizationDetail` (after line 65):

```swift
    /// Fetch optimization sections + job context for a given optimization ID.
    case optimizationDetail(id: String)

    /// In-context preview for a single ATS keyword suggestion, before approving it.
    case keywordSuggestionPreview(optimizationId: String, suggestionId: String)
```

And add its path next to `optimizationDetail`'s path case (after line 132):

```swift
        case .optimizationDetail(let id):
            return "/api/v1/optimizations/\(id)"

        case .keywordSuggestionPreview(let optimizationId, let suggestionId):
            return "/api/v1/optimizations/\(optimizationId)/suggestions/\(suggestionId)/preview"
```

- [ ] **Step 2: Add the response DTO**

In `Core/API/Models/DomainModels.swift`, add this new struct right after `ChatApproveChangeResponseDTO` (after line 1328):

```swift
/// POST `/api/v1/optimizations/:id/suggestions/:suggestionId/preview`
struct KeywordSuggestionPreviewDTO: Decodable, Sendable {
    let suggestionId: String?
    let affectedFields: [ChatAffectedField]

    private enum CodingKeys: String, CodingKey {
        case suggestionId = "suggestion_id"
        case affectedFields = "affected_fields"
    }
}
```

- [ ] **Step 3: Add the client method to `ChatService`**

In `Core/API/ChatService.swift`, add to the `ChatMessaging` protocol (near the existing `approveChange` declaration, around line 32-38):

```swift
    func previewKeywordSuggestion(
        optimizationId: String,
        suggestionId: String,
        token: String?
    ) async throws -> KeywordSuggestionPreviewDTO
```

And implement it on the `ChatService` struct (near the existing `approveChange` implementation, around line 111-132):

```swift
    func previewKeywordSuggestion(
        optimizationId: String,
        suggestionId: String,
        token: String?
    ) async throws -> KeywordSuggestionPreviewDTO {
        guard let token else { throw ChatServiceError.missingToken }
        return try await apiClient.postJSONObject(
            endpoint: .keywordSuggestionPreview(optimizationId: optimizationId, suggestionId: suggestionId),
            bodyObject: [:],
            token: token,
            timeout: 60
        )
    }
```

- [ ] **Step 4: Build to confirm it compiles**

Run (from the iOS project root, the inner `ResumeBuilder IOS APP` directory):
```bash
xcodebuild -project "ResumeBuilder IOS APP.xcodeproj" -scheme "ResumeBuilder IOS APP" -destination "generic/platform=iOS Simulator" build 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`. If it fails on `ChatMessaging` protocol conformance, search for any other type conforming to `ChatMessaging` (e.g. a test mock or preview stub) and add a matching stub implementation there too.

- [ ] **Step 5: Commit**

```bash
git add "Core/API/Endpoints.swift" "Core/API/ChatService.swift" "Core/API/Models/DomainModels.swift"
git commit -m "feat(ats): add client call for per-keyword in-context preview"
```

---

### Task C2: Surface keyword suggestions and preview/approve state on `OptimizedResumeViewModel`

**Files:**
- Modify: `ViewModels/OptimizedResumeViewModel.swift`

- [ ] **Step 1: Add state for keyword suggestions and their preview/approval status**

In `ViewModels/OptimizedResumeViewModel.swift`, add new properties next to the existing `atsBlockers` (line 33):

```swift
    var atsBlockers: [ATSOptimizationBlocker] = []
    /// Keyword-only blockers, surfaced separately so the UI can offer per-keyword approve/reject.
    var keywordSuggestions: [ATSOptimizationBlocker] {
        atsBlockers.filter { $0.category == "keywords" }
    }
    /// Cached in-context preview per suggestion id, fetched lazily on demand.
    var keywordPreviews: [String: [ChatAffectedField]] = [:]
    var keywordPreviewErrors: [String: String] = [:]
    var keywordsBeingPreviewed: Set<String> = []
    var keywordsBeingApproved: Set<String> = []
    var keywordsApproved: Set<String> = []
    private let chatService: any ChatMessaging = ChatService()
```

- [ ] **Step 2: Add `previewKeyword` and `approveKeyword` methods**

Add these methods near `improveATS` (after its closing brace, around line 583):

```swift
    func previewKeyword(suggestionId: String, token: String?) async {
        guard let optId = optimizationId, let token else { return }
        guard keywordPreviews[suggestionId] == nil else { return }

        keywordsBeingPreviewed.insert(suggestionId)
        keywordPreviewErrors[suggestionId] = nil
        defer { keywordsBeingPreviewed.remove(suggestionId) }

        do {
            let dto = try await chatService.previewKeywordSuggestion(
                optimizationId: optId,
                suggestionId: suggestionId,
                token: token
            )
            keywordPreviews[suggestionId] = dto.affectedFields
        } catch let apiError as APIClientError {
            keywordPreviewErrors[suggestionId] = apiError.userFacingMessage
        } catch {
            keywordPreviewErrors[suggestionId] = error.localizedDescription
        }
    }

    func approveKeyword(suggestionId: String, token: String?) async {
        guard let optId = optimizationId, let token else { return }
        guard let fields = keywordPreviews[suggestionId] else { return }

        keywordsBeingApproved.insert(suggestionId)
        defer { keywordsBeingApproved.remove(suggestionId) }

        do {
            let dto = try await chatService.approveChange(
                optimizationId: optId,
                suggestionId: suggestionId,
                affectedFields: fields,
                token: token
            )
            mergeApproveSnapshot(dto.updatedResume)
            keywordsApproved.insert(suggestionId)
        } catch let apiError as APIClientError {
            keywordPreviewErrors[suggestionId] = apiError.userFacingMessage
        } catch {
            keywordPreviewErrors[suggestionId] = error.localizedDescription
        }
    }

    func rejectKeyword(suggestionId: String) {
        keywordPreviews[suggestionId] = nil
        keywordPreviewErrors[suggestionId] = nil
    }
```

- [ ] **Step 3: Confirm `ChatMessaging`, `ChatService`, `ChatAffectedField`, and `mergeApproveSnapshot` are all accessible from this file**

Run: `grep -n "^import\|class OptimizedResumeViewModel" "ViewModels/OptimizedResumeViewModel.swift" | head -5`

These are all in the same module (no `import` needed for same-target Swift types) — `ChatService`, `ChatMessaging`, and `ChatAffectedField` are defined in `Core/API/ChatService.swift` and `Core/API/Models/DomainModels.swift` respectively, both in the same app target. If the build in the next step fails with "cannot find type", check whether `ChatService`/`ChatMessaging` are marked `internal` (default) vs `private` — they should already be internal since `ChatViewModel.swift` uses them.

- [ ] **Step 4: Build to confirm it compiles**

Run:
```bash
xcodebuild -project "ResumeBuilder IOS APP.xcodeproj" -scheme "ResumeBuilder IOS APP" -destination "generic/platform=iOS Simulator" build 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
git add "ViewModels/OptimizedResumeViewModel.swift"
git commit -m "feat(ats): add per-keyword preview/approve state to OptimizedResumeViewModel"
```

---

### Task C3: Add the "Addable keywords" card to the optimized-resume screen

**Files:**
- Modify: `Features/V2/Improve/OptimizedResumeView.swift`

This is the screen confirmed (via `grep -rln "atsInsightRows\|Score signals"`) to be the exact screen shown in the user's screenshots — it already renders the "Score signals" panel (lines 341-348) and the "Top blockers" list (lines 350-366) inside the same card. The new "Addable keywords" section goes directly below "Top blockers" and above the "Improve ATS" button (before line 368).

- [ ] **Step 1: Insert the new section into the existing card**

In `Features/V2/Improve/OptimizedResumeView.swift`, find this block (around line 350-367):

```swift
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text("Top blockers")
                    .font(.appCaption.weight(.bold))
                    .foregroundStyle(AppColors.textTertiary)
                ForEach(Array(viewModel.atsRecommendedActions.prefix(3).enumerated()), id: \.offset) { _, action in
                    HStack(alignment: .top, spacing: AppSpacing.sm) {
                        Circle()
                            .fill(AppColors.accentTeal)
                            .frame(width: 7, height: 7)
                            .padding(.top, 6)
                        Text(action)
                            .font(.appCaption.weight(.semibold))
                            .foregroundStyle(AppColors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
```

Immediately after its closing brace, insert:

```swift

            if !viewModel.keywordSuggestions.isEmpty {
                addableKeywordsSection
            }
```

- [ ] **Step 2: Add the `addableKeywordsSection` view and its row builder**

Add these as new private computed properties/methods in the same file, near `atsInsightRow` (after its closing brace, around line 438):

```swift
    private var addableKeywordsSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("Addable keywords")
                .font(.appCaption.weight(.bold))
                .foregroundStyle(AppColors.textTertiary)
            Text("These appear in the job description but not your resume. Review the proposed wording before adding it.")
                .font(.appCaption)
                .foregroundStyle(AppColors.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            ForEach(viewModel.keywordSuggestions) { blocker in
                keywordSuggestionRow(blocker)
            }
        }
    }

    private func keywordSuggestionRow(_ blocker: ATSOptimizationBlocker) -> some View {
        let suggestionId = blocker.id
        let isApproved = viewModel.keywordsApproved.contains(suggestionId)
        let isPreviewing = viewModel.keywordsBeingPreviewed.contains(suggestionId)
        let isApproving = viewModel.keywordsBeingApproved.contains(suggestionId)
        let preview = viewModel.keywordPreviews[suggestionId]
        let error = viewModel.keywordPreviewErrors[suggestionId]

        return VStack(alignment: .leading, spacing: AppSpacing.xs) {
            HStack(alignment: .top, spacing: AppSpacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(blocker.title)
                        .font(.appCaption.weight(.semibold))
                        .foregroundStyle(AppColors.textPrimary)
                    if let detail = blocker.detail, detail != blocker.title {
                        Text(detail)
                            .font(.appCaption)
                            .foregroundStyle(AppColors.textTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: AppSpacing.sm)

                if isApproved {
                    Label("Added", systemImage: "checkmark.circle.fill")
                        .font(.appCaption.weight(.semibold))
                        .foregroundStyle(AppColors.accentTeal)
                } else if preview == nil {
                    Button {
                        Task { await viewModel.previewKeyword(suggestionId: suggestionId, token: appState.session?.accessToken) }
                    } label: {
                        if isPreviewing {
                            ProgressView()
                        } else {
                            Text("Preview")
                                .font(.appCaption.weight(.semibold))
                        }
                    }
                    .disabled(isPreviewing)
                }
            }

            if let preview, !isApproved {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    ForEach(Array(preview.enumerated()), id: \.offset) { _, field in
                        if let newValue = field.newValue {
                            Text(describeAffectedFieldChange(field, newValue: newValue))
                                .font(.appCaption)
                                .foregroundStyle(AppColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    HStack(spacing: AppSpacing.sm) {
                        Button {
                            Task { await viewModel.approveKeyword(suggestionId: suggestionId, token: appState.session?.accessToken) }
                        } label: {
                            if isApproving {
                                ProgressView()
                            } else {
                                Text("Approve")
                                    .font(.appCaption.weight(.bold))
                            }
                        }
                        .disabled(isApproving)
                        .buttonStyle(GradientButtonStyle())

                        Button("Reject") {
                            viewModel.rejectKeyword(suggestionId: suggestionId)
                        }
                        .font(.appCaption.weight(.semibold))
                        .foregroundStyle(AppColors.textTertiary)
                    }
                }
                .padding(.top, AppSpacing.xs)
            }

            if let error {
                Text(error)
                    .font(.appCaption)
                    .foregroundStyle(AppColors.accentSky)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private func describeAffectedFieldChange(_ field: ChatAffectedField, newValue: JSONValue) -> String {
        "Proposed: \(newValue.displayString)"
    }
```

- [ ] **Step 3: Confirm `JSONValue` has a `displayString` helper, or add one**

Run: `grep -rn "displayString\|extension JSONValue" "Core/API/Models/" "Core/"`

If no `displayString` property exists on `JSONValue`, add this extension in `Core/API/Models/DomainModels.swift` near the `JSONValue` type definition:

```swift
extension JSONValue {
    var displayString: String {
        switch self {
        case .string(let s): return s
        case .array(let arr): return arr.map { $0.displayString }.joined(separator: ", ")
        case .number(let n): return "\(n)"
        case .bool(let b): return "\(b)"
        case .null: return ""
        case .object: return ""
        }
    }
}
```

(Adjust the `case` list to match `JSONValue`'s actual enum cases — check its definition first with `grep -n "enum JSONValue" -A 10 "Core/API/Models/DomainModels.swift"` and match exactly; do not guess case names.)

- [ ] **Step 4: Build to confirm it compiles**

Run:
```bash
xcodebuild -project "ResumeBuilder IOS APP.xcodeproj" -scheme "ResumeBuilder IOS APP" -destination "generic/platform=iOS Simulator" build 2>&1 | tail -40
```
Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Manually verify in the simulator**

Run the app in the iOS Simulator (via Xcode's Run button or `xcodebuild test` with a UI test target if one exists), navigate to the optimized-resume screen for an optimization that has missing must-have keywords, and confirm:
1. An "Addable keywords" section appears below "Top blockers".
2. Tapping "Preview" on a keyword shows a proposed in-context sentence (not a bare skills-list dump).
3. Tapping "Approve" updates the resume content and shows "Added".
4. Tapping "Reject" clears the preview without applying anything.

- [ ] **Step 6: Commit**

```bash
git add "Features/V2/Improve/OptimizedResumeView.swift" "Core/API/Models/DomainModels.swift"
git commit -m "feat(ats): add per-keyword approve/reject UI to optimized resume screen"
```

---

## Self-Review Notes

- **Spec coverage:** Item 1 (dig into 56/62 bars) → Phase A makes `atsBlockers` real, which makes the existing fabricated-math formula in `OptimizedResumeViewModel.atsInsightRows` (lines computing `adjustedATSScore(base:penalty:)`) act on real blocker categories instead of an always-empty array — the bars will move based on actual diagnostic content as soon as `hasATSBlocker` has real data to match against. (No code change needed there; it already reads `atsBlockers`.) Item 2 (per-keyword approval with in-context placement) → Phases B and C. Item 3 (higher ATS score) → a direct consequence of users actually approving real keyword insertions instead of the suggestion being invisible/bundled.
- **Placeholder scan:** no TBD/TODO/"add validation" placeholders remain; every step has complete code.
- **Type consistency:** `Suggestion`/`SuggestionAction` types in Task A1/B1 match `src/lib/ats/types.ts` exactly as read from the file. `ChatAffectedField`/`ChatApproveChangeResponseDTO`/`KeywordSuggestionPreviewDTO` field names match the existing iOS structs and their `CodingKeys`. `chatService.approveChange` call signature in Task C2 matches the existing one used in `ChatViewModel.approve` exactly (`optimizationId:`, `suggestionId:`, `affectedFields:`, `token:`).
