export type Json = any;

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          user_id: string;
          full_name: string | null;
          role: string | null;
          plan_type: 'free' | 'premium';
          optimizations_used: number;
          max_optimizations: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          full_name?: string | null;
          role?: string | null;
          plan_type?: 'free' | 'premium';
          optimizations_used?: number;
          max_optimizations?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          role?: string | null;
          plan_type?: 'free' | 'premium';
          optimizations_used?: number;
          max_optimizations?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      resumes: Table<
        {
          id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          raw_text: string;
          canonical_data: Json;
          embeddings: number[] | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          filename: string;
          storage_path: string;
          raw_text: string;
          canonical_data: Json;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          filename?: string;
          storage_path?: string;
          raw_text?: string;
          canonical_data?: Json;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      job_descriptions: Table<
        {
          id: string;
          user_id: string;
          source_url: string | null;
          title: string;
          company: string | null;
          raw_text: string;
          clean_text: string;
          parsed_data: Json;
          embeddings: number[] | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          source_url?: string | null;
          title: string;
          company?: string | null;
          raw_text: string;
          clean_text: string;
          parsed_data: Json;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          source_url?: string | null;
          title?: string;
          company?: string | null;
          raw_text?: string;
          clean_text?: string;
          parsed_data?: Json;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      optimizations: Table<
        {
          id: string;
          user_id: string;
          resume_id: string;
          jd_id: string;
          match_score: number;
          gaps_data: Json;
          rewrite_data: Json;
          template_key: string;
          output_paths: Json | null;
          status: 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
          resume_text: string | null;
          jd_text: string | null;
          ats_score_original: number | null;
          ats_score_optimized: number | null;
          ats_subscores: Json | null;
          ats_subscores_original: Json | null;
          ats_suggestions: Json | null;
          ats_confidence: number | null;
          ats_version: number | null;
          ai_modification_count: number | null;
        },
        {
          id?: string;
          user_id: string;
          resume_id: string;
          jd_id: string;
          match_score: number;
          gaps_data: Json;
          rewrite_data: Json;
          template_key: string;
          output_paths?: Json | null;
          status?: 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          resume_text?: string | null;
          jd_text?: string | null;
          ats_score_original?: number | null;
          ats_score_optimized?: number | null;
          ats_subscores?: Json | null;
          ats_subscores_original?: Json | null;
          ats_suggestions?: Json | null;
          ats_confidence?: number | null;
          ats_version?: number | null;
          ai_modification_count?: number | null;
        },
        {
          id?: string;
          user_id?: string;
          resume_id?: string;
          jd_id?: string;
          match_score?: number;
          gaps_data?: Json;
          rewrite_data?: Json;
          template_key?: string;
          output_paths?: Json | null;
          status?: 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          resume_text?: string | null;
          jd_text?: string | null;
          ats_score_original?: number | null;
          ats_score_optimized?: number | null;
          ats_subscores?: Json | null;
          ats_subscores_original?: Json | null;
          ats_suggestions?: Json | null;
          ats_confidence?: number | null;
          ats_version?: number | null;
          ai_modification_count?: number | null;
        },
        [
          {
            foreignKeyName: 'optimizations_resume_id_fkey';
            columns: ['resume_id'];
            referencedRelation: 'resumes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'optimizations_jd_id_fkey';
            columns: ['jd_id'];
            referencedRelation: 'job_descriptions';
            referencedColumns: ['id'];
          }
        ]
      >;
      templates: Table<
        {
          key: string;
          name: string;
          family: 'ats' | 'modern';
          config_data: Json;
          created_at: string;
          updated_at: string;
        },
        {
          key: string;
          name: string;
          family: 'ats' | 'modern';
          config_data: Json;
          created_at?: string;
          updated_at?: string;
        },
        {
          key?: string;
          name?: string;
          family?: 'ats' | 'modern';
          config_data?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      events: Table<
        {
          id: string;
          user_id: string | null;
          type: string;
          payload_data: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          type: string;
          payload_data: Json;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string | null;
          type?: string;
          payload_data?: Json;
          created_at?: string;
        }
      >;
      applications: Table<
        {
          id: string;
          user_id: string;
          optimization_id: string;
          job_title: string | null;
          company_name: string | null;
          job_url: string | null;
          status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date: string | null;
          apply_clicked_at: string | null;
          ats_score: number | null;
          contact: Json | null;
          notes: string | null;
          optimized_resume_id: string | null;
          optimized_resume_url: string | null;
          resume_html_path: string | null;
          resume_json_path: string | null;
          source_url: string | null;
          job_extraction: Json | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          optimization_id: string;
          job_title?: string | null;
          company_name?: string | null;
          job_url?: string | null;
          status?: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string | null;
          apply_clicked_at?: string | null;
          ats_score?: number | null;
          contact?: Json | null;
          notes?: string | null;
          optimized_resume_id?: string | null;
          optimized_resume_url?: string | null;
          resume_html_path?: string | null;
          resume_json_path?: string | null;
          source_url?: string | null;
          job_extraction?: Json | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          optimization_id?: string;
          job_title?: string | null;
          company_name?: string | null;
          job_url?: string | null;
          status?: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string | null;
          apply_clicked_at?: string | null;
          ats_score?: number | null;
          contact?: Json | null;
          notes?: string | null;
          optimized_resume_id?: string | null;
          optimized_resume_url?: string | null;
          resume_html_path?: string | null;
          resume_json_path?: string | null;
          source_url?: string | null;
          job_extraction?: Json | null;
          created_at?: string;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: 'applications_optimization_id_fkey';
            columns: ['optimization_id'];
            referencedRelation: 'optimizations';
            referencedColumns: ['id'];
          }
        ]
      >;
      anonymous_ats_scores: Table<
        {
          id: number;
          session_id: string;
          ip_address: string;
          ats_score: number;
          ats_subscores: Json;
          ats_suggestions: Json;
          ats_quick_wins: Json;
          resume_hash: string;
          job_description_hash: string;
          user_id: string | null;
          optimization_id: number | null;
          converted_at: string | null;
          created_at: string;
          expires_at: string;
        },
        {
          id?: number;
          session_id: string;
          ip_address: string;
          ats_score: number;
          ats_subscores: Json;
          ats_suggestions: Json;
          ats_quick_wins?: Json;
          resume_hash: string;
          job_description_hash: string;
          user_id?: string | null;
          optimization_id?: number | null;
          converted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        },
        {
          id?: number;
          session_id?: string;
          ip_address?: string;
          ats_score?: number;
          ats_subscores?: Json;
          ats_suggestions?: Json;
          ats_quick_wins?: Json;
          resume_hash?: string;
          job_description_hash?: string;
          user_id?: string | null;
          optimization_id?: number | null;
          converted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        }
      >;
      rate_limits: Table<
        {
          id: number;
          identifier: string;
          endpoint: string;
          requests_count: number;
          window_start: string;
        },
        {
          id?: number;
          identifier: string;
          endpoint: string;
          requests_count?: number;
          window_start?: string;
        },
        {
          id?: number;
          identifier?: string;
          endpoint?: string;
          requests_count?: number;
          window_start?: string;
        }
      >;
      agent_shadow_logs: Table<
        {
          id: string;
          user_id: string | null;
          intent: string[] | null;
          ats_before: number | null;
          ats_after: number | null;
          diff_count: number | null;
          warnings: string[] | null;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          intent?: string[] | null;
          ats_before?: number | null;
          ats_after?: number | null;
          diff_count?: number | null;
          warnings?: string[] | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string | null;
          intent?: string[] | null;
          ats_before?: number | null;
          ats_after?: number | null;
          diff_count?: number | null;
          warnings?: string[] | null;
          created_at?: string;
        }
      >;
      chat_sessions: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      chat_messages: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      amendment_requests: Table<
        {
          id: string;
          session_id: string;
          message_id: string;
          section: string | null;
          operation: string | null;
          value: string | null;
          target_index: number | null;
          target_field: string | null;
          reasoning: string | null;
          status: string;
          created_at: string;
          processed_at: string | null;
          rejection_reason: string | null;
          type: string | null;
          target_section: string | null;
          description: string | null;
        },
        {
          id?: string;
          session_id: string;
          message_id: string;
          section?: string | null;
          operation?: string | null;
          value?: string | null;
          target_index?: number | null;
          target_field?: string | null;
          reasoning?: string | null;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
          rejection_reason?: string | null;
          type?: string | null;
          target_section?: string | null;
          description?: string | null;
        },
        {
          id?: string;
          session_id?: string;
          message_id?: string;
          section?: string | null;
          operation?: string | null;
          value?: string | null;
          target_index?: number | null;
          target_field?: string | null;
          reasoning?: string | null;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
          rejection_reason?: string | null;
          type?: string | null;
          target_section?: string | null;
          description?: string | null;
        }
      >;
      resume_versions: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      content_modifications: Table<
        {
          id: string;
          user_id: string;
          optimization_id: string;
          operation_type: string;
          field_path: string;
          old_value: string | null;
          new_value: string | null;
          ats_score_before: number | null;
          ats_score_after: number | null;
          suggestion_text: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          optimization_id: string;
          operation_type: string;
          field_path: string;
          old_value?: string | null;
          new_value?: string | null;
          ats_score_before?: number | null;
          ats_score_after?: number | null;
          suggestion_text?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          optimization_id?: string;
          operation_type?: string;
          field_path?: string;
          old_value?: string | null;
          new_value?: string | null;
          ats_score_before?: number | null;
          ats_score_after?: number | null;
          suggestion_text?: string | null;
          created_at?: string;
        }
      >;
      design_customizations: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      design_templates: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      design_assignments: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      resume_design_assignments: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      history: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      style_customization_history: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
      ai_threads: Table<Record<string, any>, Record<string, any>, Record<string, any>>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      check_subscription_limit: {
        Args: {
          user_uuid: string;
        };
        Returns: boolean;
      };
      increment_optimization_usage: {
        Args: {
          user_uuid: string;
        };
        Returns: boolean;
      };
      increment_optimizations_used: {
        Args: {
          user_id_param: string;
          max_allowed: number;
        };
        Returns: boolean;
      };
      pg_tables_with_rls: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      upgrade_to_premium: {
        Args: {
          user_uuid: string;
        };
        Returns: boolean;
      };
      get_user_subscription_status: {
        Args: {
          user_uuid: string;
        };
        Returns: Json;
      };
      create_optimization: {
        Args: {
          user_uuid: string;
          resume_uuid: string;
          jd_uuid: string;
          initial_match_score?: number;
        };
        Returns: string;
      };
      complete_optimization: {
        Args: {
          optimization_uuid: string;
          final_match_score: number;
          optimization_result: Json;
        };
        Returns: boolean;
      };
      fail_optimization: {
        Args: {
          optimization_uuid: string;
          error_message?: string;
        };
        Returns: boolean;
      };
      get_user_dashboard_stats: {
        Args: {
          user_uuid: string;
        };
        Returns: Json;
      };
      cleanup_stale_optimizations: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      generate_file_path: {
        Args: {
          user_uuid: string;
          filename: string;
          file_type?: string;
        };
        Returns: string;
      };
      increment_rate_limit: {
        Args: {
          p_identifier: string;
          p_endpoint: string;
          p_window_ms: number;
        };
        Returns: {
          requests_count: number;
          window_start: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
