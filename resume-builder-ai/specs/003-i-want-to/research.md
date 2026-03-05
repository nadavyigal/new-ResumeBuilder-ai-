# Phase 0: Research & Design Decisions

**Feature**: AI-Powered Resume Design Selection
**Date**: 2025-10-08
**Status**: Complete

This document captures all research findings and technical decisions made during Phase 0 planning.

---

## Research Task 1: External Template Library Integration

### Decision
**Use pre-build copy script to sync templates from external library into project**

Implementation approach:
- Create `scripts/sync-external-templates.ts` to copy React components from `resume-style-bank` to `src/lib/templates/external/`
- Auto-generate TypeScript registry (`external/index.ts`) with template imports
- Run sync script before build and dev (via `prebuild` and `predev` npm scripts)
- Templates become static imports, fully bundled by Next.js

### Rationale
1. **Next.js 15 Bundling Requirements**: Next.js cannot dynamically import from external file system paths. All imports must be statically analyzable at build time for webpack/turbopack to bundle correctly.

2. **Security**: Copying at build time ensures all code is validated by TypeScript, ESLint, and bundler. No runtime code execution from external sources.

3. **Performance**: Templates are bundled with the application, enabling:
   - Automatic code splitting by Next.js
   - Edge deployment compatibility (no filesystem access needed)
   - Fast render times (no filesystem reads per request)

4. **TypeScript Safety**: Copied templates get full IDE autocomplete, type checking, and compile-time error detection.

5. **Deployment Portability**: Works in all environments (Vercel Edge, AWS Lambda, Docker, local dev) because templates are part of the build artifact.

### Alternatives Considered

#### Alternative A: Runtime Dynamic Import from External Paths (REJECTED)
- **Pros**: Templates stay external, no duplication
- **Cons**:
  - ❌ Incompatible with Next.js production bundler (requires static import paths)
  - ❌ Cannot deploy to serverless/edge (no filesystem)
  - ❌ Security risks (external code execution)
  - ❌ No TypeScript validation
- **Verdict**: Technically infeasible in Next.js 15

#### Alternative B: NPM Workspace/Monorepo (DEFERRED for V2)
- **Pros**: Clean package management, version control, publishable
- **Cons**: More complex setup, requires workspace-aware package manager
- **Verdict**: Good for future production enhancement, but pre-build copy is simpler for MVP

#### Alternative C: Database-Stored Components with eval() (REJECTED)
- **Pros**: None for this use case
- **Cons**: ❌ SEVERE SECURITY RISK (code injection), ❌ No TypeScript, ❌ CSP violations
- **Verdict**: Never use this approach

### Implementation Details
```typescript
// scripts/sync-external-templates.ts
// Copies templates from resume-style-bank to src/lib/templates/external/
// Generates auto-registry: external/index.ts with all template imports

// Usage in code:
import { getExternalTemplate } from '@/lib/templates/external';
const CardTemplate = getExternalTemplate('card-ssr');
```

---

## Research Task 2: React SSR Rendering in Next.js 15

### Decision
**Use Next.js App Router server components with `renderToStaticMarkup` for preview, Puppeteer for PDF export**

Architecture:
- **Preview**: Server component renders React template to HTML string using `react-dom/server`
- **Interactive UI**: Client components handle user interactions (template selection, customization)
- **PDF Export**: Puppeteer renders HTML to PDF (existing pattern from Feature 001)

### Rationale
1. **Next.js 15 Server Components**: Ideal for rendering resume templates server-side without client bundle bloat
2. **Performance**: `renderToStaticMarkup` is fastest (no hydration overhead), suitable for static preview
3. **Existing Infrastructure**: Reuses Puppeteer setup from existing export functionality
4. **5-Second Target**: Server component rendering + caching achieves <5s preview requirement

### Alternatives Considered

#### Alternative A: Client-Side Rendering Only (REJECTED)
- **Pros**: Simple implementation
- **Cons**:
  - ❌ Slower initial load (large React bundle)
  - ❌ Cannot meet 5s preview target for multiple templates
  - ❌ Wasted bandwidth (sends React code for static previews)
- **Verdict**: Violates performance requirements

#### Alternative B: Static Site Generation (SSG) (REJECTED)
- **Pros**: Fast serving of pre-rendered HTML
- **Cons**:
  - ❌ Cannot pre-render user-specific resume data
  - ❌ Requires rebuild for template updates
  - ❌ Not applicable for dynamic, per-user content
- **Verdict**: Wrong pattern for user-generated content

#### Alternative C: Streaming SSR (DEFERRED)
- **Pros**: Progressive rendering for faster perceived performance
- **Cons**: Added complexity, minimal benefit for single-page previews
- **Verdict**: Optimize later if 5s target not met with static SSR

### Implementation Pattern
```typescript
// src/lib/design-manager/template-renderer.ts
import { renderToStaticMarkup } from 'react-dom/server';

export function renderTemplatePreview(templateId: string, resumeData: ResumeData): string {
  const Template = getExternalTemplate(templateId);
  const html = renderToStaticMarkup(<Template data={resumeData} />);
  return `<!DOCTYPE html>${html}`;
}

// API Route: src/app/api/v1/design/templates/[id]/preview/route.ts
export async function GET(req, { params }) {
  const html = renderTemplatePreview(params.id, userResumeData);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' }
  });
}
```

---

## Research Task 3: Undo State Management

### Decision
**In-memory session state with database persistence on finalization**

Strategy:
- Store current `customization_id` and `previous_customization_id` in `resume_design_assignments` table
- Only one level of undo (single previous state)
- Undo is session-based: cleared when user finalizes design or navigates away
- No full version history (per FR-015 requirement)

### Rationale
1. **Simplicity**: Single-level undo meets requirement (FR-017) without complex state management
2. **Performance**: No need for full history tracking, reduces database writes
3. **User Expectation**: "Undo last change" is intuitive, multi-level undo adds complexity
4. **Database Schema**: Two columns (`customization_id`, `previous_customization_id`) in existing table

### Alternatives Considered

#### Alternative A: Full Version History with Linked List (REJECTED - Over-engineering)
- **Pros**: Enables unlimited undo/redo
- **Cons**:
  - ❌ Not required by spec (FR-017 only requires undo last change)
  - ❌ Additional complexity (versioning table, linked list traversal)
  - ❌ Violates YAGNI principle (Constitution Principle VII)
- **Verdict**: Over-engineered for single-level undo requirement

#### Alternative B: Client-Side Only (Session Storage) (REJECTED - Data Loss Risk)
- **Pros**: No database writes, fast undo
- **Cons**:
  - ❌ Lost on page refresh
  - ❌ Cannot undo after returning to design later
  - ❌ No server-side validation of undo state
- **Verdict**: Poor user experience

#### Alternative C: Event Sourcing Pattern (REJECTED - Overkill)
- **Pros**: Full audit trail, replay capability
- **Cons**:
  - ❌ Massive over-engineering for undo feature
  - ❌ Violates simplicity principle
- **Verdict**: Not justified for this use case

### Implementation Schema
```sql
-- resume_design_assignments table
ALTER TABLE resume_design_assignments
ADD COLUMN customization_id UUID REFERENCES design_customizations(id),
ADD COLUMN previous_customization_id UUID REFERENCES design_customizations(id);

-- Undo operation: Swap current and previous
UPDATE resume_design_assignments
SET customization_id = previous_customization_id,
    previous_customization_id = customization_id
WHERE optimization_id = $1;
```

---

## Research Task 4: AI Template Recommendation

### Decision
**GPT-4 based recommendation using resume content analysis**

Approach:
1. Extract resume metadata: industry, role, experience level, content density
2. Send to GPT-4 with template descriptions and recommendation criteria
3. Return single recommended template ID with reasoning
4. Fallback to rule-based heuristic if AI call fails

### Rationale
1. **AI Alignment**: Leverages existing OpenAI integration (Feature 001, 002)
2. **Context-Aware**: Can consider nuanced factors (creative field → modern template, traditional industry → minimal template)
3. **Explainability**: AI returns reasoning ("Recommended 'Card Layout' because your design background benefits from visual emphasis")
4. **Flexibility**: Easy to adjust recommendation criteria via prompt engineering

### Alternatives Considered

#### Alternative A: Rule-Based Heuristics Only (DEFERRED as fallback)
- **Pros**: Fast, deterministic, no API cost
- **Cons**:
  - Less personalized
  - Requires manual rule maintenance
- **Verdict**: Use as fallback, but AI provides better UX

#### Alternative B: Embeddings + Similarity Search (REJECTED - Unnecessary Complexity)
- **Pros**: Mathematical similarity scoring
- **Cons**:
  - ❌ Requires embedding all template descriptions
  - ❌ Doesn't capture nuanced matching logic
  - ❌ Overkill for 4 templates
- **Verdict**: Over-engineered for small template set

#### Alternative C: User Survey (REJECTED - Adds Friction)
- **Pros**: Direct user preference input
- **Cons**:
  - ❌ Slows onboarding flow
  - ❌ Users may not know which template suits them
- **Verdict**: AI recommendation is more seamless

### Prompt Template
```typescript
const RECOMMENDATION_PROMPT = `
You are a resume design expert. Recommend ONE template from these options:

Templates:
1. minimal-ssr: Clean, text-focused, traditional. Best for conservative industries (finance, law, government).
2. card-ssr: Modern cards for sections. Best for tech, creative, visual-heavy roles.
3. sidebar-ssr: Sidebar for contact/skills. Best for experienced professionals with dense content.
4. timeline-ssr: Chronological timeline emphasis. Best for career progressors, educators, consultants.

Resume Analysis:
- Industry: ${industry}
- Role: ${role}
- Experience Level: ${experienceYears} years
- Content Density: ${wordCount} words

Return JSON:
{
  "recommendedTemplate": "template-id",
  "reasoning": "One sentence explaining why this template fits"
}
`;
```

---

## Research Task 5: ATS Compatibility Validation

### Decision
**Whitelist-based CSS validation with constraint rules**

Rules:
- ✅ Allowed: Standard fonts (Arial, Times, Calibri), simple colors, basic spacing
- ❌ Blocked: Images (`<img>`), background images, complex layouts (flexbox ok, CSS Grid limited), tables (except simple data), custom fonts via `@font-face`
- Validation: Parse AI-generated CSS, check against whitelist, reject if violations found

### Rationale
1. **Fail-Safe**: Whitelist approach prevents ATS-breaking changes by default
2. **Simple Implementation**: Regex/AST parsing of CSS, compare against allowed properties
3. **User Guidance**: When blocked, explain why ("Images break ATS parsing - use text-based section headers instead")

### Alternatives Considered

#### Alternative A: Post-Rendering HTML Validation (REJECTED - Too Late)
- **Pros**: Validates final output
- **Cons**:
  - ❌ Detects issues after customization applied
  - ❌ Harder to explain to user what went wrong
- **Verdict**: Validate before application

#### Alternative B: AI-Based Validation (DEFERRED - Unreliable)
- **Pros**: Could catch subtle issues
- **Cons**:
  - ❌ AI may hallucinate false positives/negatives
  - ❌ Slower than rule-based
- **Verdict**: Use deterministic rules

### ATS-Safe Constraints
```typescript
const ATS_SAFE_RULES = {
  allowedTags: ['div', 'p', 'span', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'strong', 'em'],
  blockedTags: ['img', 'svg', 'canvas', 'video', 'iframe', 'object', 'embed'],
  allowedCssProperties: [
    'color', 'background-color', 'font-family', 'font-size', 'font-weight',
    'margin', 'padding', 'line-height', 'text-align', 'display', 'flex-direction'
  ],
  blockedCssProperties: [
    'background-image', 'clip-path', 'transform', 'filter', 'animation'
  ],
  allowedFonts: ['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana'],
  maxFileSize: '200KB' // Prevent bloated HTML
};
```

---

## Research Task 6: Design Customization Interpretation

### Decision
**Structured GPT-4 prompts with JSON schema output**

Approach:
1. User request: "make headers dark blue"
2. GPT-4 prompt: Parse natural language → structured CSS changes
3. Validate output against ATS rules
4. Apply customization if valid, else return error with suggestions

### Rationale
1. **Existing Pattern**: Reuses chat-manager from Feature 002
2. **Reliability**: JSON schema output forces structured responses
3. **Validation**: Can validate before applying (whitelist check)
4. **Extensibility**: Easy to add new customization types via prompt updates

### Prompt Engineering Strategy
```typescript
const CUSTOMIZATION_PROMPT = `
You are a resume design assistant. Interpret the user's design request and output valid CSS changes.

Current template: ${templateId}
Current customization:
${JSON.stringify(currentCustomization, null, 2)}

User request: "${userRequest}"

Output JSON with ONLY the fields that should change:
{
  "color_scheme": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex"
  },
  "font_family": {
    "headings": "Font Name",
    "body": "Font Name"
  },
  "spacing_settings": {
    "compact": boolean,
    "lineHeight": number (1.0-2.0)
  },
  "layout_variant": "string | null"
}

Constraints:
- Only use ATS-safe fonts: ${ATS_SAFE_RULES.allowedFonts.join(', ')}
- Only use hex colors (no rgba, gradients, images)
- If request is unclear, ask a clarifying question in "clarification_needed" field

Return:
{
  "changes": { /* CSS changes */ },
  "clarification_needed": "string | null",
  "reasoning": "one sentence explaining changes"
}
`;
```

### Alternatives Considered

#### Alternative A: Predefined Customization Options (REJECTED - Limited)
- **Pros**: No AI needed, deterministic
- **Cons**:
  - ❌ Limited to predefined color palettes/fonts
  - ❌ Poor UX (user must browse options vs. ask naturally)
- **Verdict**: Less flexible than AI interpretation

#### Alternative B: Direct CSS Editing (REJECTED - Error-Prone)
- **Pros**: Maximum control
- **Cons**:
  - ❌ Requires CSS knowledge
  - ❌ Risk of breaking ATS compatibility
  - ❌ Not user-friendly for non-developers
- **Verdict**: Target users are job seekers, not developers

---

## Summary of Decisions

| Research Area | Decision | Key Constraint | Deferred to V2 |
|---------------|----------|----------------|----------------|
| Template Loading | Pre-build copy script | Next.js bundling | NPM workspace |
| Rendering | Server components + renderToStaticMarkup | 5s preview target | Streaming SSR |
| Undo Management | Single-level DB storage | Simplicity (YAGNI) | Full version history |
| Recommendation | GPT-4 analysis | AI alignment | Embeddings similarity |
| ATS Validation | Whitelist-based CSS rules | Fail-safe approach | AI-based validation |
| Customization | Structured GPT-4 prompts | JSON schema output | Direct CSS editing |

---

## Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| External template library path changes | Build fails | Document path in .env, add validation script |
| Template incompatibility with resume schema | Rendering fails | Add schema transformation layer + tests |
| AI generates non-ATS-safe CSS | ATS compatibility broken | Whitelist validation before application |
| Preview rendering > 5 seconds | Poor UX | Cache rendered previews, optimize template complexity |
| Template sync script fails in CI/CD | Deployment blocked | Add error handling + fallback to last known good templates |

---

## Next Phase: Phase 1 (Design & Contracts)

With all research complete, Phase 1 will:
1. Create `data-model.md` with full entity schemas
2. Generate OpenAPI contracts for 7 API endpoints
3. Write failing contract tests
4. Document quickstart scenario
5. Update CLAUDE.md with new library context

**Status**: Phase 0 COMPLETE ✅
