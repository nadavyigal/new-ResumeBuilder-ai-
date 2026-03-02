import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { getClientEnv } from './env';

const env = getClientEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client-side Supabase client for use in React components
export const createClientComponentClient = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
