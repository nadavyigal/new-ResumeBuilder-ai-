import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

/**
 * Singleton Supabase client for browser
 * Prevents multiple client instances from being created on re-renders
 */
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Get or create the Supabase browser client (singleton)
 * This ensures only one client instance exists throughout the app lifecycle
 */
export const createClientComponentClient = () => {
  // Only check environment variables in browser context
  if (typeof window === 'undefined') {
    // During SSR or build, return a placeholder that won't be used
    return null as any;
  }

  // Get env vars directly from process.env to support both build and runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
};