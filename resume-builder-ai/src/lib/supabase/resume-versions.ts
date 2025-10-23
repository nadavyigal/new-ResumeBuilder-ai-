/**
 * Supabase Client Wrapper: resume_versions table
 *
 * Provides type-safe database operations for resume version snapshots with RLS enforcement.
 */

import { createClient } from '@supabase/supabase-js';
import type { ResumeVersion, ResumeVersionInsert } from '../../types/chat';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create new resume version
 *
 * @param version - Version data to insert
 * @returns Created version with auto-incremented version_number
 */
export async function createResumeVersion(
  version: ResumeVersionInsert
): Promise<ResumeVersion> {
  const supabase = getSupabaseClient();

  // Get current max version number for this optimization
  const { data: existingVersions } = await supabase
    .from('resume_versions')
    .select('version_number')
    .eq('optimization_id', version.optimization_id)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersionNumber = existingVersions && existingVersions.length > 0
    ? existingVersions[0].version_number + 1
    : 1;

  const { data, error } = await supabase
    .from('resume_versions')
    .insert({
      ...version,
      version_number: nextVersionNumber,
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create resume version: ${error.message}`);
  }

  return data as ResumeVersion;
}

/**
 * Get resume version by ID
 *
 * @param versionId - Version ID
 * @returns Version data or null if not found
 */
export async function getResumeVersion(versionId: string): Promise<ResumeVersion | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get resume version: ${error.message}`);
  }

  return data as ResumeVersion;
}

/**
 * Get latest version for optimization
 *
 * @param optimizationId - Optimization ID
 * @returns Latest version or null if none exists
 */
export async function getLatestVersion(
  optimizationId: string
): Promise<ResumeVersion | null> {
  const supabase = getSupabaseClient();

  // Remove .maybeSingle() when using .limit(1) to avoid 406 errors
  // .limit(1) returns an array, handle it properly
  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('optimization_id', optimizationId)
    .order('version_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to get latest version: ${error.message}`);
  }

  // Handle array result - return first item or null
  return (data && data.length > 0) ? data[0] as ResumeVersion : null;
}

/**
 * Get version history for optimization
 *
 * @param optimizationId - Optimization ID
 * @returns Array of versions in descending order
 */
export async function getVersionHistory(
  optimizationId: string
): Promise<ResumeVersion[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('optimization_id', optimizationId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(`Failed to get version history: ${error.message}`);
  }

  return (data as ResumeVersion[]) || [];
}

/**
 * Get version by optimization and version number
 *
 * @param optimizationId - Optimization ID
 * @param versionNumber - Version number
 * @returns Version data or null if not found
 */
export async function getVersionByNumber(
  optimizationId: string,
  versionNumber: number
): Promise<ResumeVersion | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('optimization_id', optimizationId)
    .eq('version_number', versionNumber)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get version by number: ${error.message}`);
  }

  return data as ResumeVersion;
}

/**
 * Get versions for a session
 *
 * @param sessionId - Session ID
 * @returns Array of versions created in this session
 */
export async function getSessionVersions(sessionId: string): Promise<ResumeVersion[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get session versions: ${error.message}`);
  }

  return (data as ResumeVersion[]) || [];
}
