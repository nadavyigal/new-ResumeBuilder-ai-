# How to Fix 406 Error: "Cannot coerce the result to a single JSON object"

## Problem
Error occurs when using Supabase's `.single()` method, which throws a 406 error when it can't guarantee exactly one result.

## Root Cause
The `.single()` method is too strict and fails in these cases:
- No results found (should return null)
- Multiple results found (database constraint issue)
- Any ambiguity in the query

## Solution
Replace **ALL** instances of `.single()` with `.maybeSingle()` and add proper null checks.

## Where to Look

### Critical Locations (CHECK THESE FIRST):
1. **`resume-builder-ai/src/lib/supabase/*.ts`** - All database wrapper functions
2. **`resume-builder-ai/src/lib/design-manager/*.ts`** - Design-related functions
3. **`resume-builder-ai/src/lib/template-engine/*.ts`** - Template functions
4. **`resume-builder-ai/src/app/api/**/*.ts`** - API route handlers
5. **`resume-builder-ai/src/app/dashboard/**/*.tsx`** - Page components

### Search Command:
```bash
cd "resume-builder-ai/src" && grep -rn "\.single()" --include="*.ts" --include="*.tsx"
```

## Fix Pattern

### Before (WRONG):
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .single();  // ❌ Throws 406 error

if (error || !data) {
  return null;
}
```

### After (CORRECT):
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .maybeSingle();  // ✅ Returns null if not found

if (error) {
  throw new Error(`Failed: ${error.message}`);
}

if (!data) {
  return null; // or throw error depending on function signature
}
```

## Bulk Replacement (Use with Caution)

```bash
cd "resume-builder-ai/src/lib"

# Replace in lib files
sed -i 's/\.single();/.maybeSingle();/g' \
  supabase/*.ts \
  design-manager/*.ts \
  template-engine/*.ts

# Replace multiline .single() (on separate line)
sed -i 's/\.single()$/.maybeSingle()/g' \
  supabase/*.ts
```

**⚠️ IMPORTANT:** After bulk replacement, manually add null checks to functions that return non-nullable types!

## Manual Null Check Additions

After replacing `.single()` → `.maybeSingle()`, check each function:

### For functions returning nullable types:
```typescript
Promise<Type | null>
```
Already safe - `.maybeSingle()` returns null correctly.

### For functions returning non-nullable types:
```typescript
Promise<Type>  // NOT nullable
```
Add null check:
```typescript
if (!data) {
  throw new Error('Record not found');
}
return data;
```

## Files Fixed in Last Resolution (Oct 21, 2025):

### Library Files (30 instances):
- `resume-builder-ai/src/lib/supabase/chat-sessions.ts` (4)
- `resume-builder-ai/src/lib/supabase/resume-designs.ts` (3) ✅ with null checks
- `resume-builder-ai/src/lib/supabase/design-templates.ts` (2)
- `resume-builder-ai/src/lib/supabase/chat-messages.ts` (2)
- `resume-builder-ai/src/lib/template-engine/index.ts` (1)
- `resume-builder-ai/src/lib/design-manager/undo-manager.ts` (4)
- `resume-builder-ai/src/lib/supabase/design-customizations.ts` (2)
- `resume-builder-ai/src/lib/supabase/amendment-requests.ts` (3)
- `resume-builder-ai/src/lib/supabase/resume-versions.ts` (4)
- `resume-builder-ai/src/lib/supabase/auth.ts` (4)

## Verification

After fixing, verify no `.single()` calls remain:
```bash
grep -rn "\.single()" resume-builder-ai/src --include="*.ts" --include="*.tsx"
```

Should only find:
- Comments (containing `.single()` as text)
- The cache-buster utility that references the error code

## Testing

1. Restart dev server: `npm run dev`
2. Test affected pages in browser
3. If cached errors persist, use incognito window

## Prevention

Add this to your code review checklist:
- ❌ Never use `.single()` in Supabase queries
- ✅ Always use `.maybeSingle()` + null checks
- ✅ Handle both error and null cases separately

---

**Last Updated:** 2025-10-21
**Status:** ✅ RESOLVED
