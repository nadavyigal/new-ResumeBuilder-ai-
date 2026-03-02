-- Migration: Create ai_threads table for OpenAI Assistant thread management
-- Feature: 008-enhance-ai-assistent
-- Date: 2025-01-18

BEGIN;

-- Create ai_threads table
CREATE TABLE IF NOT EXISTS ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  openai_thread_id VARCHAR(255) NOT NULL UNIQUE,
  openai_assistant_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_active_thread_per_optimization
    UNIQUE (optimization_id, status)
    WHERE status = 'active'
);

-- Create indexes for performance
CREATE INDEX idx_ai_threads_user_id ON ai_threads(user_id);
CREATE INDEX idx_ai_threads_optimization_id ON ai_threads(optimization_id);
CREATE INDEX idx_ai_threads_session_id ON ai_threads(session_id);
CREATE INDEX idx_ai_threads_openai_thread_id ON ai_threads(openai_thread_id);
CREATE INDEX idx_ai_threads_status ON ai_threads(status);

-- Enable Row Level Security
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own threads"
  ON ai_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads"
  ON ai_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON ai_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON ai_threads FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
