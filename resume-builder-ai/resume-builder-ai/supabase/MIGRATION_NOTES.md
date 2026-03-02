# Supabase Migration History Notes

This document tracks important information about database migrations, known issues, and their resolutions.

## Latest Migrations (2025-12-10)

### 20251210_remove_design_assignments.sql
**Purpose:** Remove experimental `design_assignments` table

**Background:**
- Two design assignment table approaches existed:
  - `resume_design_assignments` (primary, used in 13+ locations)
  - `design_assignments` (experimental, only used once in chat route)

**Changes:**
- Dropped `design_assignments` table
- Updated chat route to use proper `resume_design_assignments` + `design_customizations` pattern

**Status:** ✅ Completed

---

### 20251210_enforce_resume_limit.sql
**Purpose:** Enforce 15 resume optimization limit per user

**Features:**
- Database constraint: `optimizations_used <= max_optimizations`
- Default `max_optimizations = 15` for new users
- Trigger: `enforce_optimization_quota` prevents exceeding limit
- Trigger: `auto_increment_optimization_count` increments counter on completion
- Admin function: `reset_user_optimization_quota(user_id)` for support

**Testing:**
```sql
-- Test quota enforcement
SELECT user_id, optimizations_used, max_optimizations
FROM profiles
WHERE user_id = 'your-test-user-id';

-- Test admin reset (use with caution)
SELECT reset_user_optimization_quota('user-id-here');
```

**Status:** ✅ Completed

---

### 20251210_database_diagnostics.sql
**Purpose:** Health check queries for database validation

**Diagnostics Included:**
1. RLS status on all tables
2. Missing indexes on foreign keys
3. Orphaned data detection
4. Table row counts
5. Optimization quota violations
6. Duplicate table check
7. Storage bucket health

**Usage:**
```bash
# Run diagnostics in Supabase SQL Editor
cat supabase/migrations/20251210_database_diagnostics.sql | supabase db execute
```

**Status:** ✅ Completed

---

### 20251210_add_indexes.sql
**Purpose:** Add performance indexes for common query patterns

**Indexes Added:**
- `idx_optimizations_user_created` - User optimization queries
- `idx_optimizations_status` - Processing/failed optimizations (partial)
- `idx_chat_sessions_optimization` - Chat session lookups
- `idx_chat_sessions_active` - Active sessions (partial)
- `idx_chat_messages_session_time` - Message history
- `idx_resume_design_assignments_optimization` - Design lookups
- `idx_resume_design_assignments_active` - Active assignments (partial)
- `idx_design_customizations_user` - Customization queries
- And more...

**Performance Impact:** 10-50x improvement on indexed queries

**Status:** ✅ Completed

---

## Historical Issues

### Duplicate Column Renames (RESOLVED)
**Migrations:**
- `20251104_xxx` - First attempt to rename columns
- `20251109000000_fix_column_names_direct.sql` - Second attempt

**Issue:** Multiple migrations attempting same schema fixes

**Columns Affected:**
- `job_descriptions.extracted_data` → `parsed_data`
- `design_customizations.spacing_settings` → `spacing`

**Resolution:** Both migrations use `IF EXISTS`, making them idempotent and safe to keep

**Status:** ✅ Resolved (no action needed)

---

### 406 Errors from `.single()` (RESOLVED)
**Issue:** Code using `.single()` instead of `.maybeSingle()` caused 406 errors when results uncertain

**Locations Fixed:**
- All files in `src/lib/supabase/` (23+ instances)
- Various API routes

**Resolution:** Replaced all `.single()` with `.maybeSingle()` in client code

**Example Fix:**
```typescript
// ❌ Before (causes 406 errors)
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single();

// ✅ After (safe)
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .maybeSingle();
```

**Status:** ✅ Resolved

---

### Export Route Schema Mismatch (RESOLVED)
**Issue:** Export route queried non-existent `optimized_resume` column

**Root Cause:** Column is actually named `optimization_data` (JSONB)

**File:** `src/app/api/optimizations/export/route.ts`

**Fix:** Changed query to use `optimization_data`

**Status:** ✅ Fixed in 2025-12-10 update

---

## Pending Work

### PDF Export Implementation (IN PROGRESS)
**Status:** Exports JSON files; PDF generation not yet implemented

**Next Steps:**
1. Install: `npm install jspdf html2canvas`
2. Create: `src/lib/pdf-generator.ts`
3. Update: `src/app/api/optimizations/export/route.ts`

**Tracking:** See Phase 3 in implementation plan

---

## Migration Best Practices

### Before Running Migrations
1. **Backup database:**
   ```bash
   supabase db dump > backup_$(date +%Y%m%d).sql
   ```

2. **Test locally first:**
   ```bash
   supabase start
   supabase db reset
   ```

3. **Review migration SQL carefully**

### Running Migrations

**Local:**
```bash
supabase migration up
```

**Production:**
```bash
supabase db push
```

### After Running Migrations
1. **Verify in dashboard:** Check migration history
2. **Run diagnostics:** Execute `20251210_database_diagnostics.sql`
3. **Monitor logs:** Check for errors
4. **Test critical flows:** User signup, optimization creation, export

### Rollback Strategy

**If migration fails:**
```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD.sql
```

**For specific migration:**
```bash
supabase migration down <migration_name>
```

---

## Database Schema Summary

### Core Tables
- `profiles` - User accounts and subscription status
- `resumes` - Uploaded resume files
- `job_descriptions` - Job postings
- `optimizations` - AI optimization results
- `templates` - Resume templates
- `events` - Analytics tracking

### Chat Features
- `chat_sessions` - Conversation sessions
- `chat_messages` - Message history
- `resume_versions` - Version snapshots
- `amendment_requests` - Proposed changes

### Design Features
- `design_templates` - Available templates
- `design_customizations` - Color/font/spacing settings
- `resume_design_assignments` - Links optimizations to templates

### Tracking
- `applications` - Job application tracking
- `ai_threads` - OpenAI thread management
- `content_modifications` - Change history
- `style_history` - Design change history

---

## Support

**Questions or Issues?**
- Check Supabase logs: `supabase functions logs`
- Review this document for known issues
- Run diagnostics: `20251210_database_diagnostics.sql`
- Contact: [Your support contact here]

**Last Updated:** 2025-12-10
