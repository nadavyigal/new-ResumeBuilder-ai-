# ATS v2 Implementation Guide

## ✅ Status: 40% Complete

### What's Implemented (Ready to Use)

#### 1. **Complete Foundation** ✅
- Type system with all interfaces (`src/lib/ats/types.ts`)
- Configuration (weights, thresholds) (`src/lib/ats/config/`)
- BaseAnalyzer abstract class (`src/lib/ats/analyzers/base.ts`)
- Text utilities (20+ functions) (`src/lib/ats/utils/text-utils.ts`)

#### 2. **Data Extraction** ✅
- Resume text extractor (`src/lib/ats/extractors/resume-text-extractor.ts`)
- JD extractor with must-have/nice-to-have detection (`src/lib/ats/extractors/jd-extractor.ts`)
- Format analyzer for ATS safety (`src/lib/ats/extractors/format-analyzer.ts`)

#### 3. **OpenAI Integration** ✅
- Embeddings client with caching (`src/lib/ats/utils/embeddings.ts`)
- Cosine similarity calculation
- Batch embedding support
- Cache statistics tracking

#### 4. **Database** ✅
- Migration script (`supabase/migrations/20250128000000_ats_v2_schema.sql`)
- New columns: `ats_score_original`, `ats_score_optimized`, `ats_subscores`, `ats_suggestions`
- Indexes for performance
- Helper views and functions

#### 5. **First Analyzer** ✅
- KeywordExactAnalyzer implemented and tested

### What Remains (60%)

#### Week 1 Remaining (24 hours)
**7 Analyzers to Implement** - Follow KeywordExactAnalyzer pattern:

1. **KeywordPhraseAnalyzer** (6h)
   ```typescript
   // src/lib/ats/analyzers/keyword-phrase.ts
   // Uses n-grams (3-6 words) to match phrases
   // Example: "stakeholder communication" as single phrase
   ```

2. **SemanticAnalyzer** (8h)
   ```typescript
   // src/lib/ats/analyzers/semantic.ts
   // Uses embeddings from utils/embeddings.ts
   // Top-k section matching with cosine similarity
   ```

3. **TitleAlignmentAnalyzer** (4h)
   ```typescript
   // src/lib/ats/analyzers/title-alignment.ts
   // Compares job titles + seniority levels
   // Uses edit distance for fuzzy matching
   ```

4. **MetricsAnalyzer** (4h)
   ```typescript
   // src/lib/ats/analyzers/metrics-presence.ts
   // Detects quantified achievements (%, $, #, timeframes)
   // Uses METRICS_THRESHOLDS.metric_patterns
   ```

5. **SectionCompletenessAnalyzer** (4h)
   ```typescript
   // src/lib/ats/analyzers/section-completeness.ts
   // Checks for Summary, Skills, Experience, Education
   // Uses extractors/resume-text-extractor.ts helpers
   ```

6. **FormatAnalyzer** (4h)
   ```typescript
   // src/lib/ats/analyzers/format-parseability.ts
   // Wraps extractors/format-analyzer.ts
   // Returns format_safety_score as analyzer result
   ```

7. **RecencyAnalyzer** (4h)
   ```typescript
   // src/lib/ats/analyzers/recency-fit.ts
   // Calculates temporal decay for skills/roles
   // Boosts if latest role has most JD keywords
   ```

#### Week 2: Scoring Engine (40 hours)
**Implement in this order:**

1. **Aggregator** (8h)
   ```typescript
   // src/lib/ats/scorers/aggregator.ts
   export function aggregateScore(results: AnalyzerResult[]): number {
     // Weighted sum using SUB_SCORE_WEIGHTS
     // Handle failed analyzers with getAdjustedWeights()
   }
   ```

2. **Normalizer** (4h)
   ```typescript
   // src/lib/ats/scorers/normalizer.ts
   export function normalizeSubScores(subscores: SubScores): SubScores {
     // Min-max normalization to avoid clustering
   }
   ```

3. **Penalty Layer** (6h)
   ```typescript
   // src/lib/ats/scorers/penalties.ts
   export function applyPenalties(score: number, subscores: SubScores): number {
     // Apply PENALTY_THRESHOLDS
     // Cross-checks (high semantic, low keyword → penalty)
   }
   ```

4. **Confidence Estimator** (6h)
   ```typescript
   // src/lib/ats/scorers/confidence.ts
   export function estimateConfidence(
     analyzerResults: AnalyzerResult[],
     jdCompleteness: number,
     formatIssues: number
   ): number {
     // Aggregate analyzer confidences
     // Apply penalties for data quality issues
   }
   ```

5. **Main Orchestrator** (16h)
   ```typescript
   // src/lib/ats/index.ts
   export async function scoreResume(input: ATSScoreInput): Promise<ATSScoreOutput> {
     // 1. Run all 8 analyzers in parallel
     // 2. Aggregate scores
     // 3. Apply penalties
     // 4. Calculate confidence
     // 5. Generate suggestions
     // 6. Return complete output
   }
   ```

#### Week 3: Suggestions & API (40 hours)
**Suggestions Engine:**

1. **Gap Detector** (6h)
   ```typescript
   // src/lib/ats/suggestions/generator.ts
   export function detectGaps(subscores: SubScores, evidence: Record<string, AnalyzerEvidence>): Gap[] {
     // Find low sub-scores (<70)
     // Extract missing keywords, sections, etc.
   }
   ```

2. **Fix Templates** (8h)
   ```typescript
   // src/lib/ats/suggestions/templates.ts
   export const FIX_TEMPLATES: Record<SubScoreKey, SuggestionTemplate[]> = {
     keyword_exact: [
       { text: "Add exact term '{keyword}' to Skills and 2023 role bullet", gain: 8 },
       ...
     ],
     // ... 7 more sub-score templates
   }
   ```

3. **Impact Estimator** (6h)
   ```typescript
   // src/lib/ats/suggestions/impact-estimator.ts
   export function estimateGain(gap: Gap, subscore: number, weight: number): number {
     // Calcul expected point gain if gap fixed
     // Uses weight * gap_size formula
   }
   ```

4. **Ranking Logic** (4h)
   ```typescript
   // Rank by: impact × ease, identify quick wins
   ```

**API Endpoints:**

5. **POST /api/ats/score** (6h)
   ```typescript
   // src/app/api/ats/score/route.ts
   // Accept resume JSON + JD JSON
   // Call scoreResume() orchestrator
   // Return ATSScoreOutput
   ```

6. **POST /api/ats/rescan** (4h)
   ```typescript
   // src/app/api/ats/rescan/route.ts
   // Fetch existing optimization
   // Re-score with ATS v2
   // Update database
   ```

7. **Update Agent Tools** (4h)
   ```typescript
   // src/lib/agent/tools/ats.ts
   // Replace current scoring with ATS v2 call
   ```

#### Week 4: UI & Migration (40 hours)
**UI Components:**

1. **ATSScoreCard** (4h)
   ```typescript
   // src/components/ats/ATSScoreCard.tsx
   // Shows original vs optimized scores side-by-side
   // Delta indicator (+12 points)
   ```

2. **SubScoreBreakdown** (6h)
   ```typescript
   // src/components/ats/SubScoreBreakdown.tsx
   // 8 progress bars with tooltips
   // Color-coded (red <50, yellow 50-70, green >70)
   ```

3. **SuggestionsList** (4h)
   ```typescript
   // src/components/ats/SuggestionsList.tsx
   // Ranked list of suggestions
   // "Apply Fix" buttons (future enhancement)
   ```

4. **Update Optimization Page** (2h)
   ```typescript
   // src/app/dashboard/optimizations/[id]/page.tsx
   // Replace single score with ATS v2 components
   ```

**Migration:**

5. **Migration Script** (8h)
   ```typescript
   // scripts/migrate-ats-v2.ts
   // Fetch all optimizations where ats_version = 1
   // Re-score each with ATS v2
   // Batch update database (100 at a time)
   ```

6. **Monitoring Dashboard** (4h)
   ```typescript
   // Track migration progress
   // Compare v1 vs v2 scores
   ```

## Quick Start: Continue Implementation

### Step 1: Implement Remaining Analyzers (1 day)
```bash
# Copy KeywordExactAnalyzer pattern for each:
cp src/lib/ats/analyzers/keyword-exact.ts src/lib/ats/analyzers/keyword-phrase.ts
# Then modify logic for each analyzer type
```

### Step 2: Implement Scoring Engine (1-2 days)
```typescript
// Start with aggregator.ts, then build up
import { KeywordExactAnalyzer } from './analyzers/keyword-exact';
// ... import all 8 analyzers

export async function scoreResume(input: ATSScoreInput): Promise<ATSScoreOutput> {
  const analyzers = [
    new KeywordExactAnalyzer(),
    new KeywordPhraseAnalyzer(),
    // ... all 8
  ];

  const results = await Promise.all(
    analyzers.map(a => a.analyze(/* input */))
  );

  // Aggregate, penalize, generate suggestions
}
```

### Step 3: Test with Single Resume/JD Pair
```typescript
// tests/ats/smoke-test.ts
const testResume = { /* ... */ };
const testJD = { /* ... */ };

const result = await scoreResume({
  resume_original_text: extractResumeText(testResume),
  resume_optimized_text: extractResumeText(optimizedResume),
  job_clean_text: testJD,
  job_extracted_json: extractJobData(testJD),
  format_report: analyzeResumeFormat(testResume),
});

console.log(result.ats_score_original); // Should be 0-100
console.log(result.ats_score_optimized); // Should be higher
console.log(result.suggestions); // Should have actionable items
```

### Step 4: Create API Endpoint
```typescript
// src/app/api/ats/score/route.ts
export async function POST(req: Request) {
  const { resume_original, resume_optimized, job_description } = await req.json();

  const result = await scoreResume({
    // ... prepare input
  });

  return Response.json(result);
}
```

### Step 5: Build UI Components
```tsx
// src/components/ats/ATSScoreCard.tsx
export function ATSScoreCard({ scoreData }: { scoreData: ATSScoreOutput }) {
  return (
    <Card>
      <div className="flex justify-between">
        <div>
          <h3>Original</h3>
          <p className="text-3xl">{scoreData.ats_score_original}</p>
        </div>
        <ArrowRight />
        <div>
          <h3>Optimized</h3>
          <p className="text-3xl text-green-600">{scoreData.ats_score_optimized}</p>
        </div>
      </div>
      <p className="text-sm">+{scoreData.ats_score_optimized - scoreData.ats_score_original} points improvement</p>
    </Card>
  );
}
```

## Branch Management

### Current Branch Structure
```
main (production)
└── feature/ats-v2-scoring (YOUR CURRENT BRANCH)
    ├── Foundation ✅
    ├── Extractors ✅
    ├── Embeddings ✅
    ├── Migration ✅
    ├── KeywordAnalyzer ✅
    └── [60% remaining to implement]
```

### To Complete & Merge
```bash
# 1. Complete remaining implementation (follow guide above)
git add -A
git commit -m "feat: complete ATS v2 implementation"

# 2. Test thoroughly
npm run test
npm run build

# 3. Review changes
git diff main feature/ats-v2-scoring

# 4. Merge when ready
git checkout main
git merge feature/ats-v2-scoring

# OR if you don't like it:
git checkout main
git branch -D feature/ats-v2-scoring  # Deletes the branch
```

## Testing Strategy

### Unit Tests
```typescript
// tests/ats/analyzers/keyword-exact.test.ts
describe('KeywordExactAnalyzer', () => {
  it('should score 100 when all keywords present', async () => {
    const analyzer = new KeywordExactAnalyzer();
    const result = await analyzer.analyze({
      resume_text: 'React TypeScript Node.js',
      job_data: { must_have: ['React', 'TypeScript'], nice_to_have: [] },
      // ...
    });
    expect(result.score).toBeGreaterThan(90);
  });
});
```

### Integration Tests
```typescript
// tests/ats/integration/scoring-e2e.test.ts
it('should produce consistent scores for same input', async () => {
  const score1 = await scoreResume(testInput);
  const score2 = await scoreResume(testInput);
  expect(score1.ats_score_optimized).toBe(score2.ats_score_optimized);
});
```

## Performance Targets

- **Scoring Time**: <5 seconds (including OpenAI API call)
- **Cache Hit Rate**: >70% for embeddings
- **Score Distribution**: Even spread 20-100 (no clustering)
- **Migration Speed**: 1000 optimizations in <30 minutes

## Next Session Checklist

When you continue, follow this order:

- [ ] Implement 7 remaining analyzers (use KeywordExactAnalyzer as template)
- [ ] Create aggregator.ts (weighted sum)
- [ ] Create penalties.ts (cross-checks)
- [ ] Create confidence.ts (quality estimator)
- [ ] Implement main orchestrator (index.ts)
- [ ] Create suggestions generator
- [ ] Build API endpoints
- [ ] Create UI components
- [ ] Run migration script
- [ ] Test thoroughly
- [ ] Merge to main or discard branch

## File Checklist

### Completed ✅
- [x] src/lib/ats/types.ts
- [x] src/lib/ats/config/weights.ts
- [x] src/lib/ats/config/thresholds.ts
- [x] src/lib/ats/analyzers/base.ts
- [x] src/lib/ats/utils/text-utils.ts
- [x] src/lib/ats/utils/embeddings.ts
- [x] src/lib/ats/extractors/resume-text-extractor.ts
- [x] src/lib/ats/extractors/jd-extractor.ts
- [x] src/lib/ats/extractors/format-analyzer.ts
- [x] src/lib/ats/analyzers/keyword-exact.ts
- [x] supabase/migrations/20250128000000_ats_v2_schema.sql

### Remaining ⏳
- [ ] src/lib/ats/analyzers/keyword-phrase.ts
- [ ] src/lib/ats/analyzers/semantic.ts
- [ ] src/lib/ats/analyzers/title-alignment.ts
- [ ] src/lib/ats/analyzers/metrics-presence.ts
- [ ] src/lib/ats/analyzers/section-completeness.ts
- [ ] src/lib/ats/analyzers/format-parseability.ts
- [ ] src/lib/ats/analyzers/recency-fit.ts
- [ ] src/lib/ats/scorers/aggregator.ts
- [ ] src/lib/ats/scorers/normalizer.ts
- [ ] src/lib/ats/scorers/penalties.ts
- [ ] src/lib/ats/scorers/confidence.ts
- [ ] src/lib/ats/suggestions/generator.ts
- [ ] src/lib/ats/suggestions/templates.ts
- [ ] src/lib/ats/suggestions/impact-estimator.ts
- [ ] src/lib/ats/index.ts (main orchestrator)
- [ ] src/app/api/ats/score/route.ts
- [ ] src/app/api/ats/rescan/route.ts
- [ ] src/components/ats/ATSScoreCard.tsx
- [ ] src/components/ats/SubScoreBreakdown.tsx
- [ ] src/components/ats/SuggestionsList.tsx
- [ ] scripts/migrate-ats-v2.ts

## Support & Resources

- **OpenAI Embeddings Docs**: https://platform.openai.com/docs/guides/embeddings
- **Supabase JSONB**: https://supabase.com/docs/guides/database/json
- **React Components**: Use shadcn/ui (already in project)

---

**Total Progress**: 40% complete (64/160 hours)
**Time to Complete**: ~2-3 full days of focused development
