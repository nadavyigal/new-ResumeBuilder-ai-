# Quickstart Implementation Guide

**Feature**: 008-enhance-ai-assistent
**Estimated Time**: 3-4 weeks
**Prerequisites**: Next.js, TypeScript, Supabase, OpenAI SDK

## Overview

This guide provides a step-by-step implementation plan for enhancing the AI assistant with smart content modifications, thread ID error fixes, and real-time visual customization.

## Phase 1: Critical Bug Fixes (Week 1)

### Day 1-2: Fix Thread ID Error

**Goal**: Identify and fix the "undefined thread ID" error.

#### Step 1: Investigate Frontend Code

```bash
# Search for thread-related code in frontend
cd resume-builder-ai
grep -r "thread" --include="*.tsx" --include="*.ts" src/
grep -r "openai.beta.threads" --include="*.tsx" --include="*.ts" src/
```

**Check these locations**:
- `src/components/**` - React components
- `src/hooks/**` - Custom hooks
- `src/app/**` - Next.js pages
- `src/lib/**` - Utility functions

#### Step 2: Add Thread Management (If Using Assistants API)

**Create**: `src/lib/ai-assistant/thread-manager.ts`

```typescript
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Get or create OpenAI thread for optimization
 */
export async function ensureThread(
  optimizationId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();

  // Check for existing thread
  const { data: existingThread } = await supabase
    .from('ai_threads')
    .select('openai_thread_id')
    .eq('optimization_id', optimizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingThread?.openai_thread_id) {
    console.log('[Thread] Using existing thread:', existingThread.openai_thread_id);
    return existingThread.openai_thread_id;
  }

  // Create new thread
  try {
    const thread = await openai.beta.threads.create();
    console.log('[Thread] Created new thread:', thread.id);

    // Save to database
    await supabase
      .from('ai_threads')
      .insert({
        user_id: userId,
        optimization_id: optimizationId,
        openai_thread_id: thread.id,
        status: 'active',
      });

    return thread.id;
  } catch (error) {
    console.error('[Thread] Failed to create thread:', error);
    throw new Error('Failed to initialize AI assistant thread');
  }
}

/**
 * Archive thread when optimization is complete
 */
export async function archiveThread(threadId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('ai_threads')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('openai_thread_id', threadId);
}
```

#### Step 3: Update Chat API Route

**Modify**: `src/app/api/v1/chat/route.ts`

```typescript
// Add at top
import { ensureThread } from '@/lib/ai-assistant/thread-manager';

// In POST handler, after getting user
const { data: { user } } = await supabase.auth.getUser();

// Ensure thread exists (if using Assistants API)
let threadId: string | undefined;
try {
  threadId = await ensureThread(optimization_id, user.id);
} catch (error) {
  console.error('[Chat] Thread initialization failed:', error);
  // Continue without thread ID - use regular chat completions
}

// Use threadId in OpenAI calls if available
```

#### Step 4: Add Error Recovery

**Create**: `src/lib/ai-assistant/error-recovery.ts`

```typescript
export async function recoverFromThreadError(
  error: Error,
  optimizationId: string,
  userId: string
): Promise<string | null> {
  console.error('[Recovery] Thread error:', error.message);

  // If thread is invalid, create a new one
  if (error.message.includes('thread') || error.message.includes('undefined')) {
    const supabase = await createClient();

    // Archive broken thread
    await supabase
      .from('ai_threads')
      .update({ status: 'error' })
      .eq('optimization_id', optimizationId)
      .eq('user_id', userId);

    // Create new thread
    return ensureThread(optimizationId, userId);
  }

  return null;
}
```

### Day 3-5: Implement Smart Content Modification

**Goal**: Fix resume field updates to modify in-place rather than creating duplicates.

#### Step 1: Create Field Path Resolver

**Create**: `src/lib/resume/field-path-resolver.ts`

```typescript
import type { OptimizedResume } from '@/lib/ai-optimizer';

export interface FieldPath {
  root: string;
  indices: number[];
  property: string | null;
  fullPath: string;
}

/**
 * Parse JSON path string into components
 * Example: "experiences[0].title" → { root: "experiences", indices: [0], property: "title" }
 */
export function parseFieldPath(path: string): FieldPath {
  const parts = path.split('.');
  const root = parts[0].replace(/\[.*\]/, ''); // Remove array notation
  const indices: number[] = [];
  const matches = path.match(/\[(\d+)\]/g);

  if (matches) {
    matches.forEach(match => {
      const index = parseInt(match.slice(1, -1));
      indices.push(index);
    });
  }

  const property = parts.length > 1 ? parts[parts.length - 1] : null;

  return {
    root,
    indices,
    property,
    fullPath: path,
  };
}

/**
 * Get value at field path
 */
export function getFieldValue(resume: OptimizedResume, path: string): any {
  const { root, indices, property } = parseFieldPath(path);

  let current: any = resume[root as keyof OptimizedResume];

  if (!current) {
    throw new Error(`Field path root '${root}' does not exist`);
  }

  // Navigate through array indices
  for (const index of indices) {
    if (!Array.isArray(current)) {
      throw new Error(`Expected array at path '${path}' but found ${typeof current}`);
    }
    if (index >= current.length) {
      throw new Error(`Index ${index} out of bounds (length: ${current.length})`);
    }
    current = current[index];
  }

  // Get property if specified
  if (property && current) {
    if (!(property in current)) {
      throw new Error(`Property '${property}' does not exist at path '${path}'`);
    }
    return current[property];
  }

  return current;
}

/**
 * Set value at field path
 */
export function setFieldValue(
  resume: OptimizedResume,
  path: string,
  value: any
): OptimizedResume {
  const updated = structuredClone(resume);
  const { root, indices, property } = parseFieldPath(path);

  let current: any = updated;

  // Navigate to parent object
  current = current[root];

  for (let i = 0; i < indices.length; i++) {
    if (i === indices.length - 1 && !property) {
      // Last index and no property - we're modifying array item
      current[indices[i]] = value;
      return updated;
    }
    current = current[indices[i]];
  }

  // Set property
  if (property) {
    current[property] = value;
  } else {
    updated[root as keyof OptimizedResume] = value as any;
  }

  return updated;
}

/**
 * Validate field path exists in resume
 */
export function validateFieldPath(resume: OptimizedResume, path: string): boolean {
  try {
    getFieldValue(resume, path);
    return true;
  } catch {
    return false;
  }
}
```

#### Step 2: Create Modification Applier

**Create**: `src/lib/resume/modification-applier.ts`

```typescript
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { getFieldValue, setFieldValue, validateFieldPath } from './field-path-resolver';

export type ModificationOperation = 'replace' | 'prefix' | 'suffix' | 'append' | 'insert' | 'remove';

export interface ModificationRequest {
  operation: ModificationOperation;
  targetPath: string;
  value: any;
  index?: number; // For 'insert' operation
}

export interface ModificationResult {
  success: boolean;
  updatedResume: OptimizedResume;
  oldValue: any;
  newValue: any;
  error: string | null;
}

/**
 * Apply modification to resume
 */
export function applyModification(
  resume: OptimizedResume,
  modification: ModificationRequest
): ModificationResult {
  try {
    // Validate path exists
    if (!validateFieldPath(resume, modification.targetPath)) {
      return {
        success: false,
        updatedResume: resume,
        oldValue: null,
        newValue: null,
        error: `Field path '${modification.targetPath}' does not exist`,
      };
    }

    const oldValue = getFieldValue(resume, modification.targetPath);
    let newValue: any;
    let updatedResume: OptimizedResume;

    switch (modification.operation) {
      case 'replace':
        newValue = modification.value;
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      case 'prefix':
        if (typeof oldValue !== 'string') {
          throw new Error('Prefix operation requires string field');
        }
        newValue = modification.value + oldValue;
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      case 'suffix':
        if (typeof oldValue !== 'string') {
          throw new Error('Suffix operation requires string field');
        }
        newValue = oldValue + modification.value;
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      case 'append':
        if (!Array.isArray(oldValue)) {
          throw new Error('Append operation requires array field');
        }
        newValue = [...oldValue, modification.value];
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      case 'insert':
        if (!Array.isArray(oldValue)) {
          throw new Error('Insert operation requires array field');
        }
        const insertIndex = modification.index ?? 0;
        newValue = [
          ...oldValue.slice(0, insertIndex),
          modification.value,
          ...oldValue.slice(insertIndex),
        ];
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      case 'remove':
        if (Array.isArray(oldValue)) {
          // Remove item from array
          newValue = oldValue.filter(item =>
            JSON.stringify(item) !== JSON.stringify(modification.value)
          );
        } else {
          // Set to null or empty string
          newValue = typeof oldValue === 'string' ? '' : null;
        }
        updatedResume = setFieldValue(resume, modification.targetPath, newValue);
        break;

      default:
        throw new Error(`Unknown operation: ${modification.operation}`);
    }

    return {
      success: true,
      updatedResume,
      oldValue,
      newValue,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      updatedResume: resume,
      oldValue: null,
      newValue: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

#### Step 3: Create Intent-to-Modification Parser

**Create**: `src/lib/ai-assistant/modification-parser.ts`

```typescript
import type { ModificationRequest } from '@/lib/resume/modification-applier';

/**
 * Parse natural language message into modification requests
 */
export async function parseModificationIntent(
  message: string,
  resumeSchema: any
): Promise<ModificationRequest[]> {
  const lowerMessage = message.toLowerCase();

  // Pattern: "add [word] to [field]"
  if (lowerMessage.includes('add') && lowerMessage.includes('to')) {
    const addMatch = message.match(/add\s+([^\s]+)\s+to\s+(?:my\s+)?(.+?)\s*$/i);
    if (addMatch) {
      const [, word, field] = addMatch;

      // Determine field path
      let targetPath: string;
      if (field.includes('job title') || field.includes('title')) {
        targetPath = 'experiences[0].title';
      } else if (field.includes('company')) {
        targetPath = 'experiences[0].company';
      } else if (field.includes('skill')) {
        targetPath = 'skills.technical';
      } else {
        // Unknown field - need clarification
        return [];
      }

      // Determine operation
      if (targetPath.endsWith('.title') || targetPath.endsWith('.company')) {
        // String field - use prefix
        return [{
          operation: 'prefix',
          targetPath,
          value: word + ' ',
        }];
      } else if (targetPath.startsWith('skills')) {
        // Array field - use append
        return [{
          operation: 'append',
          targetPath,
          value: word,
        }];
      }
    }
  }

  // Pattern: "change [field] to [value]"
  if (lowerMessage.includes('change') && lowerMessage.includes('to')) {
    const changeMatch = message.match(/change\s+(?:my\s+)?(.+?)\s+to\s+(.+?)\s*$/i);
    if (changeMatch) {
      const [, field, value] = changeMatch;

      let targetPath: string;
      if (field.includes('job title') || field.includes('title')) {
        targetPath = 'experiences[0].title';
      } else if (field.includes('company')) {
        targetPath = 'experiences[0].company';
      } else {
        return [];
      }

      return [{
        operation: 'replace',
        targetPath,
        value: value.trim(),
      }];
    }
  }

  // No patterns matched - return empty (requires clarification)
  return [];
}
```

#### Step 4: Update applySuggestions Function

**Modify**: `src/lib/agent/applySuggestions.ts`

Replace current implementation with smart field-based updates:

```typescript
import type { Suggestion } from '@/lib/ats/types';
import type { OptimizedResume } from '@/lib/ai-optimizer';
import { applyModification, type ModificationRequest } from '@/lib/resume/modification-applier';

/**
 * Apply ATS suggestions to resume intelligently
 */
export async function applySuggestions(
  resume: OptimizedResume,
  suggestions: Suggestion[]
): Promise<OptimizedResume> {
  let updatedResume = structuredClone(resume);

  for (const suggestion of suggestions) {
    const modifications = parseSuggestionToModifications(suggestion, updatedResume);

    for (const mod of modifications) {
      const result = applyModification(updatedResume, mod);
      if (result.success) {
        updatedResume = result.updatedResume;
        console.log('[applySuggestions] Applied:', mod.operation, mod.targetPath);
      } else {
        console.error('[applySuggestions] Failed:', result.error);
      }
    }
  }

  return updatedResume;
}

/**
 * Convert ATS suggestion to modification requests
 */
function parseSuggestionToModifications(
  suggestion: Suggestion,
  resume: OptimizedResume
): ModificationRequest[] {
  const mods: ModificationRequest[] = [];
  const text = suggestion.text.toLowerCase();

  // Pattern: "Add keywords: X, Y, Z to your experience"
  if (text.includes('add') && text.includes('keywords')) {
    const keywordMatch = suggestion.text.match(/keywords?:\s*([^.]+)/i);
    if (keywordMatch) {
      const keywords = keywordMatch[1]
        .split(/[,;]|\band\b/)
        .map(k => k.trim())
        .filter(Boolean);

      // Add to first experience achievements
      mods.push({
        operation: 'append',
        targetPath: 'experiences[0].achievements',
        value: `Utilized ${keywords.join(', ')} to deliver results`,
      });
    }
  }

  // Pattern: "Add 'Senior' to job title"
  if (text.includes('add') && text.includes('senior') && text.includes('title')) {
    mods.push({
      operation: 'prefix',
      targetPath: 'experiences[0].title',
      value: 'Senior ',
    });
  }

  // Pattern: "Include skill: X"
  if (text.includes('include') && text.includes('skill')) {
    const skillMatch = suggestion.text.match(/skill:\s*(\w+)/i);
    if (skillMatch) {
      mods.push({
        operation: 'append',
        targetPath: 'skills.technical',
        value: skillMatch[1],
      });
    }
  }

  return mods;
}
```

## Phase 2: Visual Customization (Week 2)

### Day 6-8: Enhance Color and Font Handling

**Goal**: Improve style parsing and validation.

#### Step 1: Enhance parseColorRequest

**Modify**: `src/lib/agent/parseColorRequest.ts`

Add extended color library and validation:

```typescript
const extendedColorMap: Record<string, string> = {
  // (See API contracts for full color map)
  'navy': '#001f3f',
  'navy blue': '#001f3f',
  // ... (add all colors from contracts/api-styles.md)
};

export function parseColorRequest(message: string): ColorRequest[] {
  // Enhanced parsing logic
  // (Implementation details in api-styles.md)
}

/**
 * Validate color accessibility
 */
export function validateColorContrast(
  backgroundColor: string,
  textColor: string
): {
  valid: boolean;
  contrastRatio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
} {
  const ratio = getContrastRatio(backgroundColor, textColor);

  return {
    valid: ratio >= 4.5,
    contrastRatio: ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7.0,
  };
}
```

#### Step 2: Test Visual Customization

Create test file: `tests/visual-customization.test.ts`

```typescript
import { parseColorRequest, validateColorContrast } from '@/lib/agent/parseColorRequest';

describe('Visual Customization', () => {
  it('should parse simple color requests', () => {
    const requests = parseColorRequest('change background to navy blue');
    expect(requests).toHaveLength(1);
    expect(requests[0].target).toBe('background');
    expect(requests[0].color).toBe('#001f3f');
  });

  it('should validate color contrast', () => {
    const result = validateColorContrast('#001f3f', '#ffffff');
    expect(result.valid).toBe(true);
    expect(result.wcagAA).toBe(true);
  });

  it('should reject poor contrast', () => {
    const result = validateColorContrast('#ffff00', '#ffffff');
    expect(result.valid).toBe(false);
    expect(result.contrastRatio).toBeLessThan(4.5);
  });
});
```

Run tests:
```bash
npm run test -- visual-customization
```

## Phase 3: Database Migrations & Integration (Week 3)

### Day 9-11: Create Database Tables

#### Step 1: Run Migrations

```bash
cd resume-builder-ai/supabase

# Create migration files
supabase migration new create_ai_threads
supabase migration new create_content_modifications
supabase migration new create_style_history
supabase migration new alter_existing_tables
```

Copy SQL from [data-model.md](data-model.md) into migration files.

Apply migrations:
```bash
supabase db push
```

#### Step 2: Verify Tables

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ai_threads', 'content_modifications', 'style_customization_history');

-- Check RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ai_threads', 'content_modifications', 'style_customization_history');
```

### Day 12-15: End-to-End Testing

#### Step 1: Manual Testing Checklist

- [ ] Thread ID error no longer occurs
- [ ] "Add Senior to job title" updates title field (not bullet)
- [ ] Background color changes apply immediately
- [ ] Font changes reflect in preview
- [ ] ATS score recalculates after modifications
- [ ] PDF export includes custom styles
- [ ] All specs 001-006 still work

#### Step 2: Automated E2E Tests

Create: `tests/e2e/ai-assistant.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Assistant Enhancements', () => {
  test('should modify job title correctly', async ({ page }) => {
    // Navigate to optimization page
    await page.goto('/dashboard/optimizations/test-id');

    // Send message
    await page.fill('[data-testid="chat-input"]', 'add Senior to my job title');
    await page.click('[data-testid="chat-send"]');

    // Wait for response
    await page.waitForSelector('[data-testid="ai-response"]');

    // Verify title updated
    const title = await page.textContent('[data-testid="experience-title-0"]');
    expect(title).toContain('Senior');
  });

  test('should change background color', async ({ page }) => {
    await page.goto('/dashboard/optimizations/test-id');

    await page.fill('[data-testid="chat-input"]', 'change background to navy blue');
    await page.click('[data-testid="chat-send"]');

    await page.waitForSelector('[data-testid="ai-response"]');

    // Verify background color changed
    const bgColor = await page.evaluate(() => {
      const preview = document.querySelector('[data-testid="resume-preview"]');
      return window.getComputedStyle(preview!).backgroundColor;
    });

    expect(bgColor).toBe('rgb(0, 31, 63)'); // #001f3f
  });
});
```

Run E2E tests:
```bash
npm run test:e2e
```

## Phase 4: Documentation & Deployment (Week 4)

### Day 16-18: Write Documentation

#### User Documentation

Create: `docs/ai-assistant-guide.md`

```markdown
# AI Assistant Guide

## Smart Content Modification

The AI assistant can now intelligently modify your resume fields:

**Examples**:
- "add Senior to my latest job title" → Updates title field
- "change my company to ABC Corp" → Updates company name
- "add React to my skills" → Adds React to skills list

## Visual Customization

Customize your resume design with natural language:

**Examples**:
- "change background to navy blue"
- "use Arial font"
- "make headers green"
```

#### Developer Documentation

Update: `README.md`

```markdown
## AI Assistant Features (Spec 008)

### Content Modification API
- Field-specific updates via JSON path resolution
- Automatic ATS rescoring after changes
- Modification history tracking

### Style Customization API
- Real-time color and font changes
- Accessibility validation (WCAG AA compliance)
- PDF export with custom styles

See `specs/improvements/` for detailed implementation docs.
```

### Day 19-20: Deploy & Monitor

#### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Error logging configured
- [ ] Performance metrics ready

#### Deploy

```bash
# Deploy to staging
git push origin improvements:staging

# Run smoke tests
npm run test:e2e -- --project=staging

# Deploy to production
git push origin improvements:main
```

#### Monitor

Watch for:
- Thread ID errors (should be 0)
- Modification success rate (target: >95%)
- ATS rescoring latency (target: <2s)
- Style application errors (target: <1%)

## Troubleshooting

### Issue: Thread ID still undefined

**Check**:
1. Is `ensureThread` being called?
2. Are migrations applied?
3. Is OpenAI API key valid?

**Fix**:
```typescript
// Add debug logging
console.log('[Debug] Thread ID:', threadId);
console.log('[Debug] Optimization ID:', optimizationId);
console.log('[Debug] User ID:', userId);
```

### Issue: Modifications not applying

**Check**:
1. Is field path valid?
2. Does resume have expected structure?
3. Are RLS policies correct?

**Fix**:
```typescript
// Validate before applying
if (!validateFieldPath(resume, targetPath)) {
  throw new Error(`Invalid field path: ${targetPath}`);
}
```

### Issue: ATS score not updating

**Check**:
1. Is `auto_rescore` enabled?
2. Is job description available?
3. Is ATS engine responding?

**Fix**:
```typescript
// Add fallback scoring
if (atsResult.error) {
  console.warn('[ATS] Using estimated score');
  scoreAfter = scoreBefore + estimatedGain;
}
```

## Success Metrics

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| Thread ID errors | 0 | - |
| Modification accuracy | >95% | - |
| ATS rescoring latency | <2s | - |
| Style application success | >99% | - |
| User satisfaction | >4/5 | - |

---

**Implementation Status**: 🟡 In Progress
**Next Review**: After Week 2
**Support**: [GitHub Issues](https://github.com/your-repo/issues)
