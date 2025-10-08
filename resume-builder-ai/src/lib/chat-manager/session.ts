/**
 * Session Management Module
 *
 * Handles chat session lifecycle: create, resume, close.
 * Enforces single active session per optimization_id.
 */

export interface SessionCreateInput {
  userId: string;
  optimizationId: string;
  context?: Record<string, unknown>;
}

export interface SessionResumeInput {
  sessionId: string;
  userId: string;
}

export interface SessionData {
  id: string;
  userId: string;
  optimizationId: string;
  status: 'active' | 'closed';
  createdAt: Date;
  lastActivityAt: Date;
  updatedAt: Date;
  context?: Record<string, unknown>;
}

/**
 * Create new chat session
 *
 * @param input - Session creation parameters
 * @returns Created session data
 * @throws Error if active session already exists for optimization
 */
export async function createSession(
  input: SessionCreateInput
): Promise<SessionData> {
  const { createChatSession } = await import('../supabase/chat-sessions');

  const session = await createChatSession({
    user_id: input.userId,
    optimization_id: input.optimizationId,
    status: 'active',
    context: input.context,
  });

  return {
    id: session.id,
    userId: session.user_id,
    optimizationId: session.optimization_id,
    status: session.status,
    createdAt: new Date(session.created_at),
    lastActivityAt: new Date(session.last_activity_at),
    updatedAt: new Date(session.updated_at),
    context: session.context,
  };
}

/**
 * Resume existing chat session
 *
 * @param input - Session resume parameters
 * @returns Resumed session data
 * @throws Error if session not found or user unauthorized
 */
export async function resumeSession(
  input: SessionResumeInput
): Promise<SessionData> {
  const { getChatSession } = await import('../supabase/chat-sessions');

  const session = await getChatSession(input.sessionId);

  if (!session) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  if (session.user_id !== input.userId) {
    throw new Error('Unauthorized: cannot access another user\'s session');
  }

  return {
    id: session.id,
    userId: session.user_id,
    optimizationId: session.optimization_id,
    status: session.status,
    createdAt: new Date(session.created_at),
    lastActivityAt: new Date(session.last_activity_at),
    updatedAt: new Date(session.updated_at),
    context: session.context,
  };
}

/**
 * Close active chat session
 *
 * @param sessionId - Session to close
 * @param userId - User ID for authorization
 * @returns Updated session data
 */
export async function closeSession(
  sessionId: string,
  userId: string
): Promise<SessionData> {
  const { getChatSession, closeChatSession } = await import('../supabase/chat-sessions');

  const existing = await getChatSession(sessionId);

  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (existing.user_id !== userId) {
    throw new Error('Unauthorized: cannot close another user\'s session');
  }

  const updated = await closeChatSession(sessionId);

  return {
    id: updated.id,
    userId: updated.user_id,
    optimizationId: updated.optimization_id,
    status: updated.status,
    createdAt: new Date(updated.created_at),
    lastActivityAt: new Date(updated.last_activity_at),
    updatedAt: new Date(updated.updated_at),
    context: updated.context,
  };
}

/**
 * Get active session for optimization (if exists)
 */
export async function getActiveSession(
  userId: string,
  optimizationId: string
): Promise<SessionData | null> {
  const { getActiveSession: getActive } = await import('../supabase/chat-sessions');

  const session = await getActive(userId, optimizationId);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    userId: session.user_id,
    optimizationId: session.optimization_id,
    status: session.status,
    createdAt: new Date(session.created_at),
    lastActivityAt: new Date(session.last_activity_at),
    updatedAt: new Date(session.updated_at),
    context: session.context,
  };
}
