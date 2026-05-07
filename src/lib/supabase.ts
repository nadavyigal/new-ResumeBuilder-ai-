import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// Use process.env directly for NEXT_PUBLIC_* vars — safe on client, no server-only validation triggered
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client for use in React components
export const createClientComponentClient = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
