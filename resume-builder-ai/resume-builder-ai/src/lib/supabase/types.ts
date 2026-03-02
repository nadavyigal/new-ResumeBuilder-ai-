export type { Database, Json } from '@/types/database';

import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export interface SubscriptionStatus {
  plan_type?: 'free' | 'premium';
  subscription_tier?: 'free' | 'premium';
  optimizations_used: number;
  max_optimizations: number;
  can_optimize: boolean;
  remaining_optimizations: number;
  member_since: string;
}

export interface DashboardStats {
  total_resumes: number;
  total_job_descriptions: number;
  total_optimizations: number;
  completed_optimizations: number;
  average_match_score: number | null;
  subscription_status: {
    plan_type?: 'free' | 'premium';
    tier?: 'free' | 'premium';
    optimizations_used: number;
    max_optimizations: number;
  };
  recent_activity: Array<{
    type: string;
    created_at: string;
    payload: Record<string, unknown>;
  }>;
}
