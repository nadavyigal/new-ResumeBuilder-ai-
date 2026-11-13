# Work Pack: Resume Library Backend — /api/v1/resumes

> Open this in the ResumeBuilder web repo.
> After this is deployed, flip `RuntimeFeatures.isResumeLibraryEnabled = true` in the iOS repo.

**Repo:** `/Users/nadavyigal/Documents/Projects /ResumeBuilder/new-ResumeBuilder-ai-`
**Context:** The iOS app calls `GET /api/v1/resumes` (and save/delete/rename variants) to power the Resume Library tab. The route does not exist — the endpoint returns 404, so iOS shows "Resume Library unavailable" via `RuntimeFeatures.isResumeLibraryEnabled = false`. This work pack creates the table and all 4 API routes.

**iOS contract (from `SavedResume.swift`):**
```swift
struct SavedResume: Codable {
    let id: String
    let filename: String
    let displayName: String?   // JSON: "display_name"
    let createdAt: String      // JSON: "created_at"
    let sizeBytes: Int?        // JSON: "size_bytes"
}
struct SavedResumesResponse: Codable {
    let resumes: [SavedResume]
}
struct SaveResumeResponse: Codable {
    let success: Bool
    let resume: SavedResume?
}
```

**Endpoints needed:**
| iOS call | Method + Path |
|----------|--------------|
| `listSavedResumes` | `GET /api/v1/resumes` |
| `saveResume(id:displayName:)` | `POST /api/v1/resumes/{id}/save` |
| `deleteResume(id:)` | `DELETE /api/v1/resumes/{id}` |
| `renameResume(id:displayName:)` | `PATCH /api/v1/resumes/{id}` |

---

## Phase 1: Supabase migration (10 min)

The `saved_resumes` table does not exist yet. No migration references `display_name` or `size_bytes` in a resumes context.

- [ ] **Create the migration file**

  File: `supabase/migrations/20260616000000_create_saved_resumes.sql`

  ```sql
  -- Saved resumes: named snapshots of optimizations that users explicitly save
  -- to their Resume Library. Linked to an optimization but independent lifecycle.
  CREATE TABLE IF NOT EXISTS saved_resumes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- The optimization this was saved from (optional — may be NULL if the source was deleted)
    optimization_id TEXT    REFERENCES optimizations(id) ON DELETE SET NULL,
    filename        TEXT    NOT NULL,
    display_name    TEXT,
    size_bytes      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- User can only see their own saved resumes
  ALTER TABLE saved_resumes ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own saved resumes"
    ON saved_resumes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE INDEX saved_resumes_user_id_idx ON saved_resumes(user_id);
  CREATE INDEX saved_resumes_created_at_idx ON saved_resumes(created_at DESC);
  ```

- [ ] **Apply in production via Supabase dashboard or CLI**
  ```bash
  # If using Supabase CLI with a linked project:
  supabase db push
  # OR paste the SQL directly into Supabase Studio > SQL Editor
  ```

- [ ] **Verify table exists**
  In Supabase Studio, run:
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'saved_resumes' ORDER BY ordinal_position;
  ```
  Expected: 7 rows — id, user_id, optimization_id, filename, display_name, size_bytes, created_at, updated_at.

---

## Phase 2: API routes (30 min)

### Route 1: GET /api/v1/resumes

File to create: `src/app/api/v1/resumes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_resumes')
    .select('id, filename, display_name, size_bytes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumes = (data || []).map(r => ({
    id: r.id,
    filename: r.filename,
    display_name: r.display_name ?? null,
    created_at: r.created_at,
    size_bytes: r.size_bytes ?? null,
  }));

  return NextResponse.json({ resumes });
}
```

### Route 2: POST /api/v1/resumes/[id]/save

File to create: `src/app/api/v1/resumes/[id]/save/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, resume: null }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const displayName: string | undefined = body.displayName ?? body.display_name;

  // Look up the optimization to get a filename and verify ownership
  const { data: opt, error: optError } = await supabase
    .from('optimizations')
    .select('id, resume_id, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (optError || !opt) {
    return NextResponse.json(
      { success: false, resume: null, error: 'Optimization not found' },
      { status: 404 }
    );
  }

  const filename = displayName
    ? `${displayName.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf`
    : `Resume_${new Date(opt.created_at).toISOString().slice(0, 10)}.pdf`;

  const { data: saved, error: insertError } = await supabase
    .from('saved_resumes')
    .insert({
      user_id: user.id,
      optimization_id: opt.id,
      filename,
      display_name: displayName ?? null,
    })
    .select('id, filename, display_name, size_bytes, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, resume: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    resume: {
      id: saved.id,
      filename: saved.filename,
      display_name: saved.display_name,
      created_at: saved.created_at,
      size_bytes: saved.size_bytes,
    },
  });
}
```

### Route 3: DELETE + PATCH /api/v1/resumes/[id]

File to create: `src/app/api/v1/resumes/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('saved_resumes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, resume: null }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const displayName: string | undefined = body.displayName ?? body.display_name;

  if (!displayName) {
    return NextResponse.json(
      { success: false, resume: null, error: 'displayName is required' },
      { status: 400 }
    );
  }

  const filename = `${displayName.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf`;

  const { data: updated, error } = await supabase
    .from('saved_resumes')
    .update({ display_name: displayName, filename, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, filename, display_name, size_bytes, created_at')
    .single();

  if (error) {
    return NextResponse.json({ success: false, resume: null }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    resume: {
      id: updated.id,
      filename: updated.filename,
      display_name: updated.display_name,
      created_at: updated.created_at,
      size_bytes: updated.size_bytes,
    },
  });
}
```

---

## Phase 3: Lint + type-check (5 min)

- [ ] Run from the project root (or `v0/` if that's where `tsconfig.json` lives):
  ```bash
  npm run lint
  npm run type-check 2>/dev/null || npx tsc --noEmit
  ```
  Expected: 0 errors. If `createRouteHandlerClient` signature differs, check `src/lib/supabase-server.ts` and match the import pattern used in adjacent route files (e.g., `src/app/api/v1/applications/route.ts`).

---

## Phase 4: Test the routes (10 min)

With a dev server running (`npm run dev` in `v0/`) and a signed-in test account:

- [ ] **GET /api/v1/resumes** — should return `{ resumes: [] }` (empty, no saved resumes yet)
  ```bash
  curl -s http://localhost:3000/api/v1/resumes \
    -H "Cookie: <your session cookie>" | python3 -m json.tool
  ```

- [ ] **POST /api/v1/resumes/{real-optimization-id}/save**
  ```bash
  curl -s -X POST http://localhost:3000/api/v1/resumes/<opt-id>/save \
    -H "Cookie: <your session cookie>" \
    -H "Content-Type: application/json" \
    -d '{"displayName": "My Test Resume"}' | python3 -m json.tool
  ```
  Expected: `{ "success": true, "resume": { "id": "...", "filename": "My Test Resume.pdf", ... } }`

- [ ] **GET /api/v1/resumes** again — should now return 1 resume

- [ ] **PATCH /api/v1/resumes/{saved-id}** with `{"displayName": "Renamed Resume"}`

- [ ] **DELETE /api/v1/resumes/{saved-id}** — then GET again to confirm it's gone

---

## Phase 5: Commit and deploy (5 min)

- [ ] Commit:
  ```bash
  git add supabase/migrations/20260616000000_create_saved_resumes.sql \
          src/app/api/v1/resumes/route.ts \
          src/app/api/v1/resumes/\[id\]/route.ts \
          src/app/api/v1/resumes/\[id\]/save/route.ts
  git commit -m "feat: add /api/v1/resumes endpoint — Resume Library CRUD"
  git push origin main
  ```

- [ ] Confirm Vercel deployment succeeds (no build errors)

- [ ] Smoke-test against production URL:
  ```bash
  curl -s https://resumebuilder-ai.com/api/v1/resumes \
    -H "Authorization: Bearer <token>" | python3 -m json.tool
  ```
  Expected: 200 with `{ resumes: [] }` (not 404).

---

## Phase 6: Enable Resume Library in iOS (iOS repo — 5 min)

Once the production route returns 200:

- [ ] Open `ResumeBuilder IOS APP/Core/API/RuntimeFeatures.swift` (or wherever `isResumeLibraryEnabled` is defined)
- [ ] Change:
  ```swift
  static let isResumeLibraryEnabled = false
  ```
  to:
  ```swift
  static let isResumeLibraryEnabled = true
  ```
- [ ] Build + run on simulator, open the Me tab / Resume Library — confirm it loads (empty list is correct for a new account)
- [ ] Commit:
  ```bash
  git add "ResumeBuilder IOS APP/Core/API/RuntimeFeatures.swift"
  git commit -m "feat: enable Resume Library (backend /api/v1/resumes now live)"
  git push origin main
  ```

---

## Phase 7: Update progress files

- [ ] In web repo, update `tasks/progress.md`:
  ```
  Last Completed Story: /api/v1/resumes Resume Library CRUD live (2026-06-16)
  ```
- [ ] In iOS repo, update `tasks/progress.md`:
  ```
  Last Completed Story: Resume Library enabled — RuntimeFeatures.isResumeLibraryEnabled = true (2026-06-16)
  ```
- [ ] Run `./agentic-os refresh` in Agentic OS repo

---

**Done when:** `GET https://resumebuilder-ai.com/api/v1/resumes` returns 200, the iOS Me tab Resume Library section loads instead of showing "unavailable", and both progress files are updated.
