/**
 * Supabase Database Wrapper: design_templates table
 * Provides type-safe access to design templates with RLS enforcement
 *
 * Reference: specs/003-i-want-to/data-model.md
 * Task: T024 (partial)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface DesignTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'traditional' | 'modern' | 'corporate' | 'creative';
  is_premium: boolean;
  file_path: string;
  preview_thumbnail_url: string | null;
  ats_compatibility_score: number;
  supported_customizations: {
    fonts: boolean;
    colors: boolean;
    layout: boolean;
  };
  default_config: {
    font_family: {
      heading: string;
      body: string;
    };
    color_scheme: {
      primary: string;
      secondary: string;
      accent: string;
    };
    spacing_settings: {
      compact: boolean;
      lineHeight: number;
    };
  };
  created_at: string;
  updated_at: string;
}

/**
 * Get all design templates, optionally filtered by category
 * @param supabase - Authenticated Supabase client
 * @param category - Optional category filter
 * @returns Array of design templates
 */
export async function getDesignTemplates(
  supabase: SupabaseClient,
  category?: string
): Promise<DesignTemplate[]> {
  let query = supabase.from('design_templates').select('*').order('name', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch design templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single design template by ID
 * @param supabase - Authenticated Supabase client
 * @param templateId - Template UUID
 * @returns Design template or null if not found
 */
export async function getDesignTemplateById(
  supabase: SupabaseClient,
  templateId: string
): Promise<DesignTemplate | null> {
  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch design template: ${error.message}`);
  }

  return data;
}

/**
 * Get a design template by slug
 * @param supabase - Authenticated Supabase client
 * @param slug - Template slug (e.g., 'card-ssr')
 * @returns Design template or null if not found
 */
export async function getDesignTemplateBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<DesignTemplate | null> {
  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch design template: ${error.message}`);
  }

  return data;
}
