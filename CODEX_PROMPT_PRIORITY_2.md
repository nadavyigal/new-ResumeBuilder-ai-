# Priority 2: Stability & Type Safety Fixes

**Estimated Time:** 2-3 hours
**Complexity:** Medium-High
**Impact:** Critical for production stability

---

## Overview

Fix TypeScript errors, install missing dependencies, and enable build quality checks to prevent runtime failures in production.

---

## Task 1: Install Missing Sentry Dependency (5 minutes)

### Context
Sentry configuration files exist but the `@sentry/nextjs` package is not installed. This will cause errors in production when Sentry tries to initialize.

### Files Affected
- `sentry.client.config.ts` (imports @sentry/nextjs)
- `sentry.edge.config.ts` (imports @sentry/nextjs)
- `sentry.server.config.ts` (imports @sentry/nextjs)

### Instructions

**Step 1:** Install Sentry
```bash
cd resume-builder-ai
npm install @sentry/nextjs
```

**Step 2:** Verify the configuration files work
Check these files for any errors:
- `sentry.client.config.ts`
- `sentry.edge.config.ts`
- `sentry.server.config.ts`

**Step 3:** Add Sentry DSN to environment variables
Add to `.env.local`:
```env
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

**Alternative:** If you don't want to use Sentry yet, delete these three config files to prevent errors.

---

## Task 2: Fix TypeScript Database Errors (1-2 hours)

### Context
There are 80+ TypeScript errors because the Supabase client is not inferring database types correctly. All database operations are returning `never` type instead of the actual table types.

### Root Cause
The `Database` type definition is either missing or not properly imported in Supabase client files.

### Instructions

**Step 1:** Regenerate Supabase types from your database schema
```bash
cd resume-builder-ai
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

Replace `your-project-id` with your actual Supabase project ID.

**Alternative method if CLI doesn't work:**
1. Go to Supabase Dashboard → Settings → API
2. Scroll to "Generate Types"
3. Copy the TypeScript types
4. Paste into `src/types/supabase.ts`

**Step 2:** Ensure Database type is properly exported
Check `src/types/supabase.ts` has this structure:
```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          // ... other fields
        }
        Insert: {
          id: string
          // ... other fields
        }
        Update: {
          id?: string
          // ... other fields
        }
      }
      // ... other tables
    }
  }
}
```

**Step 3:** Fix Supabase client to use Database type
Check `src/lib/supabase.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createClientComponentClient = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
```

Check `src/lib/supabase-server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export async function createRouteHandlerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

**Step 4:** Fix common type errors in API routes

Example error pattern:
```typescript
// ❌ Before (returns never)
const { data, error } = await supabase
  .from("optimizations")
  .insert({ user_id: user.id, ...otherData })

// ✅ After (properly typed)
const { data, error } = await supabase
  .from("optimizations")
  .insert({
    user_id: user.id,
    status: 'pending',
    // ... ensure all required fields are present
  })
```

**Step 5:** Run TypeScript check to find remaining errors
```bash
npx tsc --noEmit
```

Fix any remaining type errors one by one. Common patterns:
- Missing required fields in INSERT operations
- Incorrect field names (check against database schema)
- Nullable fields not handled with optional chaining

**Step 6:** Test the build
```bash
npm run build
```

Should complete without TypeScript errors.

---

## Task 3: Remove Build Error Ignoring (5 minutes)

### Context
Currently, TypeScript and ESLint errors are ignored during builds. This is dangerous for production.

### Instructions

**Step 1:** Open `next.config.ts`

**Step 2:** Remove or set to false these lines:
```typescript
// ❌ Remove these
eslint: {
  ignoreDuringBuilds: true,
},
typescript: {
  ignoreBuildErrors: true,
},
```

**Step 3:** Try building
```bash
npm run build
```

If it fails, you still have TypeScript/ESLint errors to fix. Go back to Task 2.

**Step 4:** Once build succeeds, commit the changes
```bash
git add next.config.ts
git commit -m "chore: enable TypeScript and ESLint checks in builds"
```

---

## Task 4: Add Request Body Size Limits (10 minutes)

### Context
No request body size limits are configured, making the app vulnerable to DoS attacks via large payloads.

### Instructions

**Step 1:** Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // ... rest of config
};
```

**Step 2:** Add size validation in file upload routes
In `src/app/api/upload-resume/route.ts`, verify the existing size check:
```typescript
// Should already exist around line 100-108
if (resumeFile.size > 10 * 1024 * 1024) { // 10MB limit
  return NextResponse.json({ error: 'File too large' }, { status: 400 });
}
```

If not present, add it before processing the file.

---

## Verification Checklist

After completing all tasks:

- [ ] Sentry package installed (`npm list @sentry/nextjs` shows version)
- [ ] TypeScript check passes (`npx tsc --noEmit` shows 0 errors)
- [ ] Build succeeds (`npm run build` completes successfully)
- [ ] `next.config.ts` has `ignoreBuildErrors: false` or removed
- [ ] Request body size limit configured
- [ ] All API routes use properly typed Supabase client

---

## Expected Results

**Before:**
- 80+ TypeScript errors
- Builds succeed but with hidden issues
- No error monitoring
- No request size limits

**After:**
- 0 TypeScript errors
- Type-safe database operations
- Error monitoring ready
- Protected against large payload attacks
- Build process catches errors early

---

## Common Issues & Troubleshooting

### Issue: Supabase types generation fails
**Solution:** Use Supabase dashboard to manually copy types, or check your `SUPABASE_ACCESS_TOKEN` environment variable.

### Issue: Still getting `never` type errors
**Solution:** Check that:
1. `Database` type is properly exported from `src/types/supabase.ts`
2. Supabase client files import the type: `import type { Database } from '@/types/supabase'`
3. Client creation uses generic: `createBrowserClient<Database>(...)`

### Issue: Build fails after removing `ignoreBuildErrors`
**Solution:** You still have TypeScript errors. Run `npx tsc --noEmit` to see them all, then fix one by one.

### Issue: Missing required fields in INSERT operations
**Solution:** Check your database schema in Supabase Dashboard → Table Editor, ensure all required (non-nullable, no-default) fields are included in your INSERT statements.

---

## Next Steps

After completing Priority 2, proceed to Priority 3 (Production Quality & Optimizations) using the `CODEX_PROMPT_PRIORITY_3.md` file.
