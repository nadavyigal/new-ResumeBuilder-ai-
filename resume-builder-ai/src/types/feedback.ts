export type FeedbackType = 'general' | 'bug' | 'feature_request' | 'nps' | 'rating';
export type FeedbackStatus = 'new' | 'reviewed' | 'actioned' | 'closed';

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface FeedbackContext {
  page?: string;
  optimization_id?: string;
  [key: string]: string | undefined;
}

export interface Feedback {
  id: string;
  user_id: string | null;
  session_id: string | null;
  type: FeedbackType;
  rating: number | null;
  message: string | null;
  context: FeedbackContext;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackInsert {
  user_id?: string | null;
  session_id?: string | null;
  type: FeedbackType;
  rating?: number | null;
  message?: string | null;
  context?: FeedbackContext;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  subject: string;
  message: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketInsert {
  user_id?: string | null;
  email: string;
  name?: string | null;
  subject: string;
  message: string;
  category?: TicketCategory;
}

export interface AdminFeedbackUpdate {
  status?: FeedbackStatus;
  admin_notes?: string;
}

export interface AdminTicketUpdate {
  status?: TicketStatus;
  priority?: TicketPriority;
  admin_notes?: string;
}
