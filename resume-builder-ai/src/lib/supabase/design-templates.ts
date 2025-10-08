/**
 * Supabase Database Wrapper: design_templates table
 * Provides type-safe access to design templates with RLS enforcement
 *
 * Reference: specs/003-i-want-to/data-model.md
 * Task: T024 (partial)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface DesignTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'minimal' | 'professional' | 'creative' | 'modern';
  is_premium: boolean;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  color_scheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  font_family: {
    heading: string;
    body: string;
  };
  spacing: {
    section_gap: string;
    line_height: string;
  };
  ats_score: number;
  supports_custom_colors: boolean;
  supports_custom_fonts: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all design templates, optionally filtered by category
 * @param category - Optional category filter
 * @returns Array of design templates
 */
export async function getDesignTemplates(
  category?: string
): Promise<DesignTemplate[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

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
 * @param templateId - Template UUID
 * @returns Design template or null if not found
 */
export async function getDesignTemplateById(
  templateId: string
): Promise<DesignTemplate | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);

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
 * @param slug - Template slug (e.g., 'card-ssr')
 * @returns Design template or null if not found
 */
export async function getDesignTemplateBySlug(
  slug: string
): Promise<DesignTemplate | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);

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
