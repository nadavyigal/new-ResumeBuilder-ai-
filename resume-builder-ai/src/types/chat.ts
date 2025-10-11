/**
 * Chat Feature Type Definitions
 *
 * TypeScript types for chat sessions, messages, resume versions, and amendment requests.
 * Corresponds to database schema in supabase/migrations/20251006_chat_schema.sql
 */

// ========================================
// Enums and Literal Types
// ========================================

export type ChatSessionStatus = 'active' | 'closed';
export type MessageSender = 'user' | 'ai';
export type AmendmentType = 'add' | 'modify' | 'remove' | 'clarify';
export type AmendmentStatus = 'pending' | 'applied' | 'rejected' | 'needs_clarification';

// ========================================
// Database Entity Types
// ========================================

/**
 * Chat Session
 *
 * Represents an interactive conversation between user and AI for refining a specific optimized resume.
 */
export interface ChatSession {
  id: string;
  user_id: string;
  optimization_id: string;
  status: ChatSessionStatus;
  created_at: string;
  last_activity_at: string;
  updated_at: string;
  context?: Record<string, unknown>;
}

/**
 * Chat Message
 *
 * Individual message within a chat session.
 */
export interface ChatMessage {
  id: string;
  session_id: string;
  sender: MessageSender;
  content: string;
  created_at: string;
  metadata?: ChatMessageMetadata;
}

/**
 * Chat Message Metadata
 *
 * Optional structured data attached to messages.
 */
export interface ChatMessageMetadata {
  amendment_type?: AmendmentType;
  section_affected?: string;
  ai_model_version?: string;
  processing_time_ms?: number;
  [key: string]: unknown;
}

/**
 * Resume Version
 *
 * Snapshot of resume content at a specific point in time, created after chat-based amendments.
 */
export interface ResumeVersion {
  id: string;
  optimization_id: string;
  session_id: string | null;
  version_number: number;
  content: Record<string, unknown>; // Resume JSONB structure
  change_summary: string | null;
  created_at: string;
}

/**
 * Amendment Request
 *
 * Structured amendment request extracted from chat messages for processing.
 */
export interface AmendmentRequest {
  id: string;
  session_id: string;
  message_id: string;
  type: AmendmentType;
  target_section: string | null;
  status: AmendmentStatus;
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * POST /api/v1/chat - Send message request
 */
export interface ChatSendMessageRequest {
  session_id?: string; // Optional: if not provided, creates/resumes session
  optimization_id: string;
  message: string;
}

/**
 * POST /api/v1/chat - Send message response
 */
export interface ChatSendMessageResponse {
  session_id: string;
  message_id: string;
  ai_response: string;
  amendments?: AmendmentRequest[];
  requires_clarification?: boolean;
}

/**
 * GET /api/v1/chat/sessions - List sessions response
 */
export interface ChatSessionListResponse {
  sessions: ChatSession[];
  total: number;
}

/**
 * GET /api/v1/chat/sessions/{id} - Get session details response
 */
export interface ChatSessionDetailResponse {
  session: ChatSession;
  messages: ChatMessage[];
  total_messages: number;
}

/**
 * GET /api/v1/chat/sessions/{id}/messages - Get paginated messages response
 */
export interface ChatMessagesResponse {
  messages: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * POST /api/v1/chat/sessions/{id}/apply - Apply amendment request
 */
export interface ChatApplyAmendmentRequest {
  amendment_id: string;
}

/**
 * POST /api/v1/chat/sessions/{id}/apply - Apply amendment response
 */
export interface ChatApplyAmendmentResponse {
  version_id: string;
  version_number: number;
  change_summary: string;
  updated_content: Record<string, unknown>;
}

/**
 * POST /api/v1/chat/sessions/{id}/preview - Preview amendment request
 */
export interface ChatPreviewAmendmentRequest {
  message: string;
}

/**
 * POST /api/v1/chat/sessions/{id}/preview - Preview amendment response
 */
export interface ChatPreviewAmendmentResponse {
  original_content: Record<string, unknown>;
  proposed_content: Record<string, unknown>;
  diff: DiffResult[];
  change_summary: string;
}

/**
 * Diff result structure for change visualization
 */
export interface DiffResult {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  line_number?: number;
}

// ========================================
// Component Props Types
// ========================================

/**
 * ChatSidebar component props
 */
export interface ChatSidebarProps {
  optimizationId: string;
  initialOpen?: boolean;
  onClose?: () => void;
  onMessageSent?: () => void;
}

/**
 * ChatMessage component props
 */
export interface ChatMessageProps {
  message: ChatMessage;
  isLatest?: boolean;
}

/**
 * ChatInput component props
 */
export interface ChatInputProps {
  sessionId: string;
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * ChangeDiff component props
 */
export interface ChangeDiffProps {
  original: string;
  modified: string;
  showLineNumbers?: boolean;
  splitView?: boolean;
}

// ========================================
// Utility Types
// ========================================

/**
 * Database insert types (without auto-generated fields)
 */
export type ChatSessionInsert = Omit<ChatSession, 'id' | 'created_at' | 'last_activity_at' | 'updated_at'>;
export type ChatMessageInsert = Omit<ChatMessage, 'id' | 'created_at'>;
export type ResumeVersionInsert = Omit<ResumeVersion, 'id' | 'created_at'>;
export type AmendmentRequestInsert = Omit<AmendmentRequest, 'id' | 'created_at' | 'processed_at'>;

/**
 * Database update types (all fields optional except id)
 */
export type ChatSessionUpdate = Partial<Omit<ChatSession, 'id' | 'user_id' | 'optimization_id' | 'created_at'>> & { id: string };
export type AmendmentRequestUpdate = Partial<Omit<AmendmentRequest, 'id' | 'session_id' | 'message_id' | 'created_at'>> & { id: string };
