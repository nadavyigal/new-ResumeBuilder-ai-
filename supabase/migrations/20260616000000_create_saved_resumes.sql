-- Saved resumes: named snapshots of optimizations that users explicitly save
-- to their Resume Library. Linked to an optimization but independent lifecycle.
CREATE TABLE IF NOT EXISTS saved_resumes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The optimization this was saved from (optional — may be NULL if the source was deleted)
  optimization_id UUID        REFERENCES optimizations(id) ON DELETE SET NULL,
  filename        TEXT        NOT NULL,
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
