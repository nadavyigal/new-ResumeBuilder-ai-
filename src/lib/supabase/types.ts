/**
 * Supabase Database Types
 * Auto-generated types for type-safe database operations
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_shadow_logs: {
        Row: {
          ats_after: number | null
          ats_before: number | null
          created_at: string | null
          diff_count: number | null
          id: string
          intent: string[] | null
          user_id: string | null
          warnings: string[] | null
        }
        Insert: {
          ats_after?: number | null
          ats_before?: number | null
          created_at?: string | null
          diff_count?: number | null
          id?: string
          intent?: string[] | null
          user_id?: string | null
          warnings?: string[] | null
        }
        Update: {
          ats_after?: number | null
          ats_before?: number | null
          created_at?: string | null
          diff_count?: number | null
          id?: string
          intent?: string[] | null
          user_id?: string | null
          warnings?: string[] | null
        }
        Relationships: []
      }
      amendment_requests: {
        Row: {
          created_at: string
          id: string
          message_id: string
          processed_at: string | null
          rejection_reason: string | null
          session_id: string
          status: string
          target_section: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          processed_at?: string | null
          rejection_reason?: string | null
          session_id: string
          status?: string
          target_section?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          processed_at?: string | null
          rejection_reason?: string | null
          session_id?: string
          status?: string
          target_section?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "amendment_requests_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendment_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_date: string
          apply_clicked_at: string | null
          ats_score: number | null
          company_name: string | null
          contact: Json | null
          created_at: string
          id: string
          job_extraction: Json | null
          job_title: string | null
          job_url: string | null
          notes: string | null
          optimization_id: string | null
          optimized_resume_id: string | null
          optimized_resume_url: string | null
          resume_html_path: string | null
          resume_json_path: string | null
          search: unknown
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_date?: string
          apply_clicked_at?: string | null
          ats_score?: number | null
          company_name?: string | null
          contact?: Json | null
          created_at?: string
          id?: string
          job_extraction?: Json | null
          job_title?: string | null
          job_url?: string | null
          notes?: string | null
          optimization_id?: string | null
          optimized_resume_id?: string | null
          optimized_resume_url?: string | null
          resume_html_path?: string | null
          resume_json_path?: string | null
          search?: unknown
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_date?: string
          apply_clicked_at?: string | null
          ats_score?: number | null
          company_name?: string | null
          contact?: Json | null
          created_at?: string
          id?: string
          job_extraction?: Json | null
          job_title?: string | null
          job_url?: string | null
          notes?: string | null
          optimization_id?: string | null
          optimized_resume_id?: string | null
          optimized_resume_url?: string | null
          resume_html_path?: string | null
          resume_json_path?: string | null
          search?: unknown
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations_with_ats_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_optimized_resume_id_fkey"
            columns: ["optimized_resume_id"]
            isOneToOne: false
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_optimized_resume_id_fkey"
            columns: ["optimized_resume_id"]
            isOneToOne: false
            referencedRelation: "optimizations_with_ats_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          sender: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          assistant_id: string | null
          context: Json | null
          created_at: string
          id: string
          last_activity_at: string
          optimization_id: string
          resume_context: Json | null
          status: string
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assistant_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          last_activity_at?: string
          optimization_id: string
          resume_context?: Json | null
          status?: string
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assistant_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          last_activity_at?: string
          optimization_id?: string
          resume_context?: Json | null
          status?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations_with_ats_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      design_customizations: {
        Row: {
          ats_validation_errors: Json | null
          color_scheme: Json
          created_at: string
          custom_css: string | null
          font_family: Json
          id: string
          is_ats_safe: boolean
          layout_variant: string | null
          spacing_settings: Json
          template_id: string
        }
        Insert: {
          ats_validation_errors?: Json | null
          color_scheme?: Json
          created_at?: string
          custom_css?: string | null
          font_family?: Json
          id?: string
          is_ats_safe?: boolean
          layout_variant?: string | null
          spacing_settings?: Json
          template_id: string
        }
        Update: {
          ats_validation_errors?: Json | null
          color_scheme?: Json
          created_at?: string
          custom_css?: string | null
          font_family?: Json
          id?: string
          is_ats_safe?: boolean
          layout_variant?: string | null
          spacing_settings?: Json
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_customizations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "design_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      design_templates: {
        Row: {
          ats_compatibility_score: number
          category: string
          created_at: string
          default_config: Json
          description: string
          file_path: string
          id: string
          is_premium: boolean
          name: string
          preview_thumbnail_url: string | null
          slug: string
          supported_customizations: Json
          updated_at: string
        }
        Insert: {
          ats_compatibility_score?: number
          category: string
          created_at?: string
          default_config?: Json
          description: string
          file_path: string
          id?: string
          is_premium?: boolean
          name: string
          preview_thumbnail_url?: string | null
          slug: string
          supported_customizations?: Json
          updated_at?: string
        }
        Update: {
          ats_compatibility_score?: number
          category?: string
          created_at?: string
          default_config?: Json
          description?: string
          file_path?: string
          id?: string
          is_premium?: boolean
          name?: string
          preview_thumbnail_url?: string | null
          slug?: string
          supported_customizations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          id: string
          payload_data: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload_data?: Json | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload_data?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      job_descriptions: {
        Row: {
          clean_text: string
          company: string
          created_at: string | null
          embeddings: string | null
          extracted_data: Json
          id: string
          raw_text: string
          source_url: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clean_text: string
          company: string
          created_at?: string | null
          embeddings?: string | null
          extracted_data?: Json
          id?: string
          raw_text: string
          source_url?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clean_text?: string
          company?: string
          created_at?: string | null
          embeddings?: string | null
          extracted_data?: Json
          id?: string
          raw_text?: string
          source_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      optimizations: {
        Row: {
          ats_confidence: number | null
          ats_score_optimized: number | null
          ats_score_original: number | null
          ats_subscores: Json | null
          ats_subscores_original: Json | null
          ats_suggestions: Json | null
          ats_version: number | null
          created_at: string | null
          gaps_data: Json
          id: string
          jd_id: string | null
          jd_text: string | null
          match_score: number
          output_paths: Json | null
          resume_id: string | null
          resume_text: string | null
          rewrite_data: Json
          status: string | null
          template_key: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ats_confidence?: number | null
          ats_score_optimized?: number | null
          ats_score_original?: number | null
          ats_subscores?: Json | null
          ats_subscores_original?: Json | null
          ats_suggestions?: Json | null
          ats_version?: number | null
          created_at?: string | null
          gaps_data?: Json
          id?: string
          jd_id?: string | null
          jd_text?: string | null
          match_score: number
          output_paths?: Json | null
          resume_id?: string | null
          resume_text?: string | null
          rewrite_data?: Json
          status?: string | null
          template_key: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ats_confidence?: number | null
          ats_score_optimized?: number | null
          ats_score_original?: number | null
          ats_subscores?: Json | null
          ats_subscores_original?: Json | null
          ats_suggestions?: Json | null
          ats_version?: number | null
          created_at?: string | null
          gaps_data?: Json
          id?: string
          jd_id?: string | null
          jd_text?: string | null
          match_score?: number
          output_paths?: Json | null
          resume_id?: string | null
          resume_text?: string | null
          rewrite_data?: Json
          status?: string | null
          template_key?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_jd_id_fkey"
            columns: ["jd_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          optimizations_used: number | null
          plan_type: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          optimizations_used?: number | null
          plan_type?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          optimizations_used?: number | null
          plan_type?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      resume_design_assignments: {
        Row: {
          created_at: string
          customization_id: string | null
          finalized_at: string | null
          id: string
          is_active: boolean
          optimization_id: string
          original_template_id: string
          previous_customization_id: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customization_id?: string | null
          finalized_at?: string | null
          id?: string
          is_active?: boolean
          optimization_id: string
          original_template_id: string
          previous_customization_id?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customization_id?: string | null
          finalized_at?: string | null
          id?: string
          is_active?: boolean
          optimization_id?: string
          original_template_id?: string
          previous_customization_id?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_design_assignments_customization_id_fkey"
            columns: ["customization_id"]
            isOneToOne: false
            referencedRelation: "design_customizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: true
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: true
            referencedRelation: "optimizations_with_ats_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_original_template_id_fkey"
            columns: ["original_template_id"]
            isOneToOne: false
            referencedRelation: "design_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_previous_customization_id_fkey"
            columns: ["previous_customization_id"]
            isOneToOne: false
            referencedRelation: "design_customizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "design_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_design_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      resume_versions: {
        Row: {
          change_summary: string | null
          content: Json
          created_at: string
          id: string
          optimization_id: string
          session_id: string | null
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content: Json
          created_at?: string
          id?: string
          optimization_id: string
          session_id?: string | null
          version_number: number
        }
        Update: {
          change_summary?: string | null
          content?: Json
          created_at?: string
          id?: string
          optimization_id?: string
          session_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_versions_optimization_id_fkey"
            columns: ["optimization_id"]
            isOneToOne: false
            referencedRelation: "optimizations_with_ats_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_versions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          canonical_data: Json | null
          created_at: string | null
          embeddings: string | null
          filename: string
          id: string
          raw_text: string | null
          storage_path: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          canonical_data?: Json | null
          created_at?: string | null
          embeddings?: string | null
          filename: string
          id?: string
          raw_text?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          canonical_data?: Json | null
          created_at?: string | null
          embeddings?: string | null
          filename?: string
          id?: string
          raw_text?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          config_data: Json
          created_at: string | null
          family: string
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          config_data?: Json
          created_at?: string | null
          family: string
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          config_data?: Json
          created_at?: string | null
          family?: string
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      optimizations_with_ats_v2: {
        Row: {
          ats_confidence: number | null
          ats_score_improvement: number | null
          ats_score_optimized: number | null
          ats_score_original: number | null
          ats_subscores: Json | null
          ats_suggestions: Json | null
          ats_version: number | null
          created_at: string | null
          id: string | null
          jd_id: string | null
          legacy_score: number | null
          resume_id: string | null
          status: string | null
          subscore_format_parseability: Json | null
          subscore_keyword_exact: Json | null
          subscore_keyword_phrase: Json | null
          subscore_metrics_presence: Json | null
          subscore_recency_fit: Json | null
          subscore_section_completeness: Json | null
          subscore_semantic_relevance: Json | null
          subscore_title_alignment: Json | null
          template_key: string | null
          user_id: string | null
        }
        Insert: {
          ats_confidence?: number | null
          ats_score_improvement?: never
          ats_score_optimized?: number | null
          ats_score_original?: number | null
          ats_subscores?: Json | null
          ats_suggestions?: Json | null
          ats_version?: number | null
          created_at?: string | null
          id?: string | null
          jd_id?: string | null
          legacy_score?: number | null
          resume_id?: string | null
          status?: string | null
          subscore_format_parseability?: never
          subscore_keyword_exact?: never
          subscore_keyword_phrase?: never
          subscore_metrics_presence?: never
          subscore_recency_fit?: never
          subscore_section_completeness?: never
          subscore_semantic_relevance?: never
          subscore_title_alignment?: never
          template_key?: string | null
          user_id?: string | null
        }
        Update: {
          ats_confidence?: number | null
          ats_score_improvement?: never
          ats_score_optimized?: number | null
          ats_score_original?: number | null
          ats_subscores?: Json | null
          ats_suggestions?: Json | null
          ats_version?: number | null
          created_at?: string | null
          id?: string | null
          jd_id?: string | null
          legacy_score?: number | null
          resume_id?: string | null
          status?: string | null
          subscore_format_parseability?: never
          subscore_keyword_exact?: never
          subscore_keyword_phrase?: never
          subscore_metrics_presence?: never
          subscore_recency_fit?: never
          subscore_section_completeness?: never
          subscore_semantic_relevance?: never
          subscore_title_alignment?: never
          template_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optimizations_jd_id_fkey"
            columns: ["jd_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimizations_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_subscription_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      cleanup_old_files: {
        Args: { bucket_name: string; days_old?: number }
        Returns: number
      }
      generate_file_path: {
        Args: { file_type?: string; filename: string; user_uuid: string }
        Returns: string
      }
      get_ats_improvement: {
        Args: { optimization_id: string }
        Returns: number
      }
      increment_optimization_usage: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      increment_optimizations_used: {
        Args: { max_allowed: number; user_id_param: string }
        Returns: {
          created_at: string | null
          full_name: string | null
          id: string
          optimizations_used: number | null
          plan_type: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_ats_v2: { Args: { optimization_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Convenience exports used across the app
export type Profile = Tables<'profiles'>
export type ProfileInsert = TablesInsert<'profiles'>
export type ProfileUpdate = TablesUpdate<'profiles'>

export type Template = Tables<'templates'>
export type Resume = Tables<'resumes'>
export type ResumeInsert = TablesInsert<'resumes'>
export type ResumeUpdate = TablesUpdate<'resumes'>

export type JobDescription = Tables<'job_descriptions'>
export type JobDescriptionInsert = TablesInsert<'job_descriptions'>
export type JobDescriptionUpdate = TablesUpdate<'job_descriptions'>

export type Optimization = Tables<'optimizations'>
export type OptimizationInsert = TablesInsert<'optimizations'>
export type OptimizationUpdate = TablesUpdate<'optimizations'>

export type Event = Tables<'events'>

export interface SubscriptionStatus {
  subscription_tier: 'free' | 'premium'
  optimizations_used: number
  max_optimizations: number
  can_optimize: boolean
  remaining_optimizations: number
  member_since: string
}
