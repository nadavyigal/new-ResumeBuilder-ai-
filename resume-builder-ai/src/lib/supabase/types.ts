/**
 * Supabase Database Types
 * Auto-generated types for type-safe database operations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          subscription_tier: 'free' | 'premium'
          optimizations_used: number
          max_optimizations: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          subscription_tier?: 'free' | 'premium'
          optimizations_used?: number
          max_optimizations?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          subscription_tier?: 'free' | 'premium'
          optimizations_used?: number
          max_optimizations?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      templates: {
        Row: {
          key: string
          name: string
          family: 'ats' | 'modern'
          is_premium: boolean
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          name: string
          family: 'ats' | 'modern'
          is_premium?: boolean
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          name?: string
          family?: 'ats' | 'modern'
          is_premium?: boolean
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          filename: string
          original_content: string | null
          parsed_data: Json
          embeddings: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          original_content?: string | null
          parsed_data?: Json
          embeddings?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          original_content?: string | null
          parsed_data?: Json
          embeddings?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      job_descriptions: {
        Row: {
          id: string
          user_id: string
          title: string
          company: string | null
          url: string | null
          parsed_data: Json
          embeddings: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          company?: string | null
          url?: string | null
          parsed_data?: Json
          embeddings?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          company?: string | null
          url?: string | null
          parsed_data?: Json
          embeddings?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_descriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      optimizations: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          jd_id: string
          match_score: number
          optimization_data: Json
          status: 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id: string
          jd_id: string
          match_score: number
          optimization_data?: Json
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string
          jd_id?: string
          match_score?: number
          optimization_data?: Json
          status?: 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_resume_id_fkey"
            columns: ["resume_id"]
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_jd_id_fkey"
            columns: ["jd_id"]
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          id: string
          user_id: string | null
          type: string
          payload_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: string
          payload_data?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string
          payload_data?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_subscription_limit: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      increment_optimization_usage: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      upgrade_to_premium: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      get_user_subscription_status: {
        Args: {
          user_uuid: string
        }
        Returns: Json
      }
      create_optimization: {
        Args: {
          user_uuid: string
          resume_uuid: string
          jd_uuid: string
          initial_match_score?: number
        }
        Returns: string
      }
      complete_optimization: {
        Args: {
          optimization_uuid: string
          final_match_score: number
          optimization_result: Json
        }
        Returns: boolean
      }
      fail_optimization: {
        Args: {
          optimization_uuid: string
          error_message?: string
        }
        Returns: boolean
      }
      get_user_dashboard_stats: {
        Args: {
          user_uuid: string
        }
        Returns: Json
      }
      cleanup_stale_optimizations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      generate_file_path: {
        Args: {
          user_uuid: string
          filename: string
          file_type?: string
        }
        Returns: string
      }
    }
  }
}

// Convenience types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Template = Database['public']['Tables']['templates']['Row']
export type Resume = Database['public']['Tables']['resumes']['Row']
export type ResumeInsert = Database['public']['Tables']['resumes']['Insert']
export type ResumeUpdate = Database['public']['Tables']['resumes']['Update']

export type JobDescription = Database['public']['Tables']['job_descriptions']['Row']
export type JobDescriptionInsert = Database['public']['Tables']['job_descriptions']['Insert']
export type JobDescriptionUpdate = Database['public']['Tables']['job_descriptions']['Update']

export type Optimization = Database['public']['Tables']['optimizations']['Row']
export type OptimizationInsert = Database['public']['Tables']['optimizations']['Insert']
export type OptimizationUpdate = Database['public']['Tables']['optimizations']['Update']

export type Event = Database['public']['Tables']['events']['Row']

// Subscription status type
export interface SubscriptionStatus {
  subscription_tier: 'free' | 'premium'
  optimizations_used: number
  max_optimizations: number
  can_optimize: boolean
  remaining_optimizations: number
  member_since: string
}

// Dashboard statistics type
export interface DashboardStats {
  total_resumes: number
  total_job_descriptions: number
  total_optimizations: number
  completed_optimizations: number
  average_match_score: number | null
  subscription_status: {
    tier: 'free' | 'premium'
    optimizations_used: number
    max_optimizations: number
  }
  recent_activity: Array<{
    type: string
    created_at: string
    payload: Json
  }>
}