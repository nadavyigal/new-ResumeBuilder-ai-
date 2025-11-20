-- Migration: Create content_modifications table for tracking resume changes
-- Feature: 008-enhance-ai-assistent
-- Date: 2025-01-18

BEGIN;

-- Create content_modifications table
CREATE TABLE IF NOT EXISTS content_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Modification details
  operation VARCHAR(50) NOT NULL CHECK (operation IN ('replace', 'prefix', 'suffix', 'append', 'insert', 'remove')),
  field_path VARCHAR(500) NOT NULL, -- JSON path: "experiences[0].title"
  old_value TEXT,
  new_value TEXT,

  -- Context
  reason TEXT, -- User request or tip implementation
  intent VARCHAR(100), -- tip_implementation, content_edit, etc.

  -- ATS Impact
  ats_score_before DECIMAL(5,2),
  ats_score_after DECIMAL(5,2),
  score_change DECIMAL(5,2) GENERATED ALWAYS AS (ats_score_after - ats_score_before) STORED,

  -- Metadata
  applied_by VARCHAR(50) DEFAULT 'ai_assistant' CHECK (applied_by IN ('ai_assistant', 'user', 'system')),
  is_reverted BOOLEAN DEFAULT FALSE,
  reverted_at TIMESTAMP WITH TIME ZONE,
  reverted_by_modification_id UUID REFERENCES content_modifications(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_score_range CHECK (
    (ats_score_before IS NULL OR (ats_score_before >= 0 AND ats_score_before <= 100)) AND
    (ats_score_after IS NULL OR (ats_score_after >= 0 AND ats_score_after <= 100))
  )
);

-- Create indexes for performance
CREATE INDEX idx_content_mods_user_id ON content_modifications(user_id);
CREATE INDEX idx_content_mods_optimization_id ON content_modifications(optimization_id);
CREATE INDEX idx_content_mods_session_id ON content_modifications(session_id);
CREATE INDEX idx_content_mods_field_path ON content_modifications(field_path);
CREATE INDEX idx_content_mods_created_at ON content_modifications(created_at DESC);
CREATE INDEX idx_content_mods_is_reverted ON content_modifications(is_reverted) WHERE is_reverted = FALSE;

-- Enable Row Level Security
ALTER TABLE content_modifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own modifications"
  ON content_modifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own modifications"
  ON content_modifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own modifications"
  ON content_modifications FOR UPDATE
  USING (auth.uid() = user_id);

COMMIT;
