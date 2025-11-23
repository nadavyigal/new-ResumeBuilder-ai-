-- Migration: Alter existing tables for enhanced AI assistant
-- Feature: 008-enhance-ai-assistent
-- Date: 2025-01-18

BEGIN;

-- Add OpenAI thread ID to chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS openai_thread_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_openai_thread_id
  ON chat_sessions(openai_thread_id);

-- Add modification counter to optimizations
ALTER TABLE optimizations
  ADD COLUMN IF NOT EXISTS ai_modification_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_optimizations_modification_count
  ON optimizations(ai_modification_count);

-- Note: chat_messages.metadata already exists as JSONB
-- We'll use enhanced structure in the application code:
-- {
--   "intent": "tip_implementation",
--   "operation": "field_update",
--   "field_path": "experiences[0].title",
--   "modification_id": "uuid",
--   "style_change_id": "uuid",
--   "error": null
-- }

COMMIT;
