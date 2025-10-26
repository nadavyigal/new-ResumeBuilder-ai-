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

  // Debug logging to help diagnose environment variable issues
  console.log('Supabase client initialization:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl?.substring(0, 20) || 'undefined',
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(`Missing Supabase environment variables. URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`);
    console.error('Environment variables check failed:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'MISSING',
      allEnvVars: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')),
    });
    throw error;
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
};