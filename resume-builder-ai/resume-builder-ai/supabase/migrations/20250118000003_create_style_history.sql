-- Migration: Create style_customization_history table for visual customization tracking
-- Feature: 008-enhance-ai-assistent
-- Date: 2025-01-18

BEGIN;

-- Create style_customization_history table
CREATE TABLE IF NOT EXISTS style_customization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Style changes
  customization_type VARCHAR(50) NOT NULL CHECK (customization_type IN ('color', 'font', 'spacing', 'layout', 'mixed')),
  changes JSONB NOT NULL, -- { "background": "#001f3f", "font": "Arial", ... }

  -- Previous state
  previous_customization JSONB,

  -- Context
  request_text TEXT, -- User's natural language request
  applied_by VARCHAR(50) DEFAULT 'ai_assistant',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_style_history_user_id ON style_customization_history(user_id);
CREATE INDEX idx_style_history_optimization_id ON style_customization_history(optimization_id);
CREATE INDEX idx_style_history_created_at ON style_customization_history(created_at DESC);
CREATE INDEX idx_style_history_type ON style_customization_history(customization_type);

-- Enable Row Level Security
ALTER TABLE style_customization_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own style history"
  ON style_customization_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own style history"
  ON style_customization_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMIT;
