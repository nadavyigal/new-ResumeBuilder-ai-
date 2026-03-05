-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat Sessions Table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('active', 'closed')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB
);

CREATE UNIQUE INDEX idx_active_session ON chat_sessions(user_id, optimization_id) WHERE status = 'active';
CREATE INDEX idx_user_sessions ON chat_sessions(user_id, last_activity_at DESC);
CREATE INDEX idx_retention_cleanup ON chat_sessions(last_activity_at) WHERE status = 'closed';

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Chat Messages Table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_session_messages ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Resume Versions Table
CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  optimization_id UUID NOT NULL REFERENCES optimizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_version_number ON resume_versions(optimization_id, version_number);
CREATE INDEX idx_session_versions ON resume_versions(session_id, created_at DESC);

ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

-- Amendment Requests Table
CREATE TABLE amendment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('add', 'modify', 'remove', 'clarify')),
  target_section TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'applied', 'rejected', 'needs_clarification')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX idx_session_requests ON amendment_requests(session_id, created_at DESC);
CREATE INDEX idx_pending_requests ON amendment_requests(status, created_at ASC) WHERE status = 'pending';

ALTER TABLE amendment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users view own sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create own sessions" ON chat_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );

CREATE POLICY "Users update own sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users view own messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "Users create own messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

-- RLS Policies for resume_versions
CREATE POLICY "Users view own versions" ON resume_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );

CREATE POLICY "Users create own versions" ON resume_versions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM optimizations WHERE id = optimization_id AND user_id = auth.uid())
  );

-- RLS Policies for amendment_requests
CREATE POLICY "Users view own requests" ON amendment_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

-- Trigger to update last_activity_at on new messages
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET last_activity_at = NOW(), updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_created
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();
