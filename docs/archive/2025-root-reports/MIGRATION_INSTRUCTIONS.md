# Database Migration Instructions

## Applications Table Migration

The `applications` table needs to be created in Supabase to track when users apply to jobs.

### Steps to Apply Migration:

1. **Open Supabase Dashboard**
   - Go to: https://brtdyamysfmctrhuankn.supabase.co
   - Login with your credentials

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open: `resume-builder-ai/supabase/migrations/20251014000000_add_applications_table.sql`
   - Copy ALL the contents

4. **Run Migration**
   - Paste the SQL into the Supabase SQL Editor
   - Click "Run" or press Ctrl+Enter
   - You should see success messages and "Applications table created successfully"

5. **Verify Migration**
   - Go to "Table Editor" in Supabase
   - You should see a new table called `applications`
   - It should have columns: `id`, `user_id`, `optimization_id`, `status`, `applied_date`, `job_title`, `company`, `job_url`, `notes`, `created_at`, `updated_at`

### What This Migration Does:

- Creates the `applications` table for tracking job applications
- Sets up Row Level Security (RLS) so users can only see their own applications
- Creates indexes for fast queries
- Adds an auto-update trigger for the `updated_at` timestamp

### If You Don't Run This Migration:

The Apply button will show an error: "Failed to save application. Please ensure the database migration has been run."

---

## Alternative: Quick SQL (Copy & Paste)

If you prefer, here's the condensed SQL you can run directly:

```sql
-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_title TEXT,
  company TEXT,
  job_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_optimization_id ON applications(optimization_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_applied_date ON applications(applied_date DESC);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own applications" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON applications FOR DELETE USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_applications_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_applications_updated_at_trigger
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_applications_updated_at();
```
