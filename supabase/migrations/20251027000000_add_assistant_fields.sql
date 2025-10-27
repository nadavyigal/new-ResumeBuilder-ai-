-- Add OpenAI Assistants API fields to chat_sessions table
-- This enables conversation memory and persistent threads

DO $$
BEGIN
  -- Add thread_id column for OpenAI thread persistence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE public.chat_sessions ADD COLUMN thread_id TEXT;
    COMMENT ON COLUMN public.chat_sessions.thread_id IS 'OpenAI Assistants API thread ID for conversation persistence';
  END IF;

  -- Add assistant_id column to track which assistant is being used
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'assistant_id'
  ) THEN
    ALTER TABLE public.chat_sessions ADD COLUMN assistant_id TEXT;
    COMMENT ON COLUMN public.chat_sessions.assistant_id IS 'OpenAI Assistants API assistant ID';
  END IF;

  -- Add resume_context column for tracking resume state throughout conversation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'resume_context'
  ) THEN
    ALTER TABLE public.chat_sessions ADD COLUMN resume_context JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.chat_sessions.resume_context IS 'Resume state and changes made during this session';
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_thread_id ON public.chat_sessions(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_assistant_id ON public.chat_sessions(assistant_id) WHERE assistant_id IS NOT NULL;

-- Add comment on table
COMMENT ON TABLE public.chat_sessions IS 'Chat sessions with OpenAI Assistants API integration for resume editing';
