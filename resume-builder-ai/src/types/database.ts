export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          role: string | null;
          plan_type: 'free' | 'premium';
          optimizations_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          role?: string | null;
          plan_type?: 'free' | 'premium';
          optimizations_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          role?: string | null;
          plan_type?: 'free' | 'premium';
          optimizations_used?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          raw_text: string;
          canonical_data: any;
          embeddings: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          storage_path: string;
          raw_text: string;
          canonical_data: any;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          storage_path?: string;
          raw_text?: string;
          canonical_data?: any;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      job_descriptions: {
        Row: {
          id: string;
          user_id: string;
          source_url: string | null;
          title: string;
          company: string;
          raw_text: string;
          clean_text: string;
          extracted_data: any;
          embeddings: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_url?: string | null;
          title: string;
          company: string;
          raw_text: string;
          clean_text: string;
          extracted_data: any;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_url?: string | null;
          title?: string;
          company?: string;
          raw_text?: string;
          clean_text?: string;
          extracted_data?: any;
          embeddings?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      optimizations: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          jd_id: string;
          match_score: number;
          gaps_data: any;
          rewrite_data: any;
          template_key: string;
          output_paths: any;
          status: 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
          resume_text: string | null;
          jd_text: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_id: string;
          jd_id: string;
          match_score: number;
          gaps_data: any;
          rewrite_data: any;
          template_key: string;
          output_paths?: any;
          status?: 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          resume_text?: string | null;
          jd_text?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_id?: string;
          jd_id?: string;
          match_score?: number;
          gaps_data?: any;
          rewrite_data?: any;
          template_key?: string;
          output_paths?: any;
          status?: 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
          resume_text?: string | null;
          jd_text?: string | null;
        };
      };
      templates: {
        Row: {
          key: string;
          name: string;
          family: 'ats' | 'modern';
          config_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          name: string;
          family: 'ats' | 'modern';
          config_data: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          name?: string;
          family?: 'ats' | 'modern';
          config_data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          payload_data: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          payload_data: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          payload_data?: any;
          created_at?: string;
        };
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          optimization_id: string;
          job_title: string;
          company_name: string;
          job_url: string | null;
          status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          optimization_id: string;
          job_title: string;
          company_name: string;
          job_url?: string | null;
          status?: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          optimization_id?: string;
          job_title?: string;
          company_name?: string;
          job_url?: string | null;
          status?: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
          applied_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}