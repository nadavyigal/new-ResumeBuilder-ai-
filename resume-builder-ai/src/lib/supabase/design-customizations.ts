/**
 * Supabase Database Wrapper: design_customizations table
 * Provides type-safe access to design customizations with RLS enforcement
 *
 * Reference: specs/003-i-want-to/data-model.md
 * Task: T024 (partial)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface DesignCustomization {
  id: string;
  user_id: string;
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
  custom_css: string;
  is_ats_safe: boolean;
  created_at: string;
}

/**
 * Create a new design customization
 * @param userId - User ID for RLS enforcement
 * @param customization - Customization config
 * @returns Created customization
 */
export async function createDesignCustomization(
  userId: string,
  customization: Omit<DesignCustomization, 'id' | 'user_id' | 'created_at'>
): Promise<DesignCustomization> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('design_customizations')
    .insert({
      user_id: userId,
      ...customization
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create design customization: ${error.message}`);
  }

  return data;
}

/**
 * Get a design customization by ID
 * @param customizationId - Customization UUID
 * @param userId - User ID for RLS enforcement
 * @returns Design customization or null if not found
 */
export async function getDesignCustomizationById(
  customizationId: string,
  userId: string
): Promise<DesignCustomization | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('design_customizations')
    .select('*')
    .eq('id', customizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch design customization: ${error.message}`);
  }

  return data;
}

/**
 * Get all customizations for a user
 * @param userId - User ID
 * @returns Array of customizations
 */
export async function getUserCustomizations(
  userId: string
): Promise<DesignCustomization[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('design_customizations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user customizations: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete a design customization
 * @param customizationId - Customization UUID
 * @param userId - User ID for RLS enforcement
 */
export async function deleteDesignCustomization(
  customizationId: string,
  userId: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('design_customizations')
    .delete()
    .eq('id', customizationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete design customization: ${error.message}`);
  }
}
