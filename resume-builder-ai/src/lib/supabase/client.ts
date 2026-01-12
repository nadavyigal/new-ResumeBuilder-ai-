/**
 * Supabase Client Configuration
 * Provides type-safe Supabase clients for different environments
 */

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'
import { Database } from './types'

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

/**
 * Client-side Supabase client for browser usage
 * Use this in React components and client-side code
 */
export const createBrowserClient = () => {
  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Server-side Supabase client with service role key
 * Use this for server actions, API routes, and admin operations
 * ⚠️ WARNING: Only use on server-side - never expose service key to client
 */
export const createServerClient = () => {
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for server-side operations'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Standard client for public operations
 * Use this for operations that don't require authentication
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

/**
 * Configuration object for easy access to Supabase settings
 */
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageUrl: `${supabaseUrl}/storage/v1`,
  buckets: {
    resumeUploads: 'resume-uploads',
    resumeExports: 'resume-exports'
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: {
    uploads: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ],
    exports: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }
} as const
