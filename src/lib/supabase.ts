import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

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
  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return clientInstance;
};