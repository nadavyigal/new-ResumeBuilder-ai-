/**
 * Centralized environment variable validation
 *
 * This module provides type-safe access to environment variables with validation.
 * All environment variable access should go through this module to ensure:
 * 1. Variables are defined at runtime
 * 2. Clear error messages when variables are missing
 * 3. Single source of truth for environment configuration
 */

/**
 * Validates and returns a required environment variable
 * @throws Error if the variable is not defined
 */
function getRequiredEnv(key: string, context?: string): string {
  const value = process.env[key];

  if (!value) {
    const contextMsg = context ? ` (${context})` : '';
    throw new Error(
      `Missing required environment variable: ${key}${contextMsg}\n` +
      `Please ensure ${key} is set in your .env.local file or environment.`
    );
  }

  return value;
}

/**
 * Returns an optional environment variable with a default value
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// ==================== SUPABASE CONFIGURATION ====================

/**
 * Supabase project URL (public, client-side safe)
 * Lazy getter to avoid build-time evaluation
 */
let _supabaseUrl: string | undefined;
export function getSupabaseUrl(): string {
  if (!_supabaseUrl) {
    _supabaseUrl = getRequiredEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      'Required for Supabase client initialization'
    );
  }
  return _supabaseUrl;
}

/**
 * Supabase anonymous key (public, client-side safe)
 * This key respects Row Level Security policies
 * Lazy getter to avoid build-time evaluation
 */
let _supabaseAnonKey: string | undefined;
export function getSupabaseAnonKey(): string {
  if (!_supabaseAnonKey) {
    _supabaseAnonKey = getRequiredEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'Required for Supabase client initialization'
    );
  }
  return _supabaseAnonKey;
}

/**
 * Supabase service role key (server-side only, bypasses RLS)
 * WARNING: This key has full database access - never expose to client
 * Lazy getter to avoid build-time evaluation
 */
let _supabaseServiceRoleKey: string | undefined;
export function getSupabaseServiceRoleKey(): string {
  if (!_supabaseServiceRoleKey) {
    _supabaseServiceRoleKey = getRequiredEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      'Required for server-side operations that bypass RLS'
    );
  }
  return _supabaseServiceRoleKey;
}

// ==================== AI/LLM CONFIGURATION ====================

/**
 * OpenAI API key for resume optimization
 * Lazy getter to avoid build-time evaluation
 */
let _openaiApiKey: string | undefined;
export function getOpenAIApiKey(): string {
  if (!_openaiApiKey) {
    _openaiApiKey = getRequiredEnv(
      'OPENAI_API_KEY',
      'Required for AI resume optimization'
    );
  }
  return _openaiApiKey;
}

// Backward compatibility exports - use getters instead
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ==================== PAYMENT CONFIGURATION ====================

/**
 * Stripe publishable key (public, client-side safe)
 */
export const STRIPE_PUBLISHABLE_KEY = getOptionalEnv(
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ''
);

/**
 * Stripe secret key (server-side only)
 */
export const STRIPE_SECRET_KEY = getOptionalEnv(
  'STRIPE_SECRET_KEY',
  ''
);

/**
 * Stripe webhook signing secret
 * Used to verify webhook signatures from Stripe
 */
export const STRIPE_WEBHOOK_SECRET = getOptionalEnv(
  'STRIPE_WEBHOOK_SECRET',
  ''
);

/**
 * Stripe price ID for premium plan
 */
export const STRIPE_PREMIUM_PRICE_ID = getOptionalEnv(
  'STRIPE_PREMIUM_PRICE_ID',
  ''
);

// ==================== APPLICATION CONFIGURATION ====================

/**
 * Application base URL
 */
export const APP_URL = getOptionalEnv(
  'NEXT_PUBLIC_APP_URL',
  'http://localhost:3000'
);

/**
 * Node environment
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Is production environment
 */
export const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * Is development environment
 */
export const IS_DEVELOPMENT = NODE_ENV === 'development';

// ==================== VALIDATION HELPERS ====================

/**
 * Validates that all required environment variables are set
 * Call this during application startup to fail fast
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // Check required variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Warn about missing optional variables in production
  if (IS_PRODUCTION) {
    const optional = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PREMIUM_PRICE_ID',
    ];

    for (const key of optional) {
      if (!process.env[key]) {
        console.warn(`Warning: Optional environment variable not set: ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Environment validation failed:\n' +
      errors.map(e => `  - ${e}`).join('\n') +
      '\n\nPlease check your .env.local file.'
    );
  }
}

/**
 * Checks if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return Boolean(
    STRIPE_SECRET_KEY &&
    STRIPE_WEBHOOK_SECRET &&
    STRIPE_PREMIUM_PRICE_ID
  );
}

/**
 * Gets Stripe configuration or throws if not configured
 */
export function getStripeConfig() {
  if (!isStripeConfigured()) {
    throw new Error(
      'Stripe is not fully configured. Please set:\n' +
      '  - STRIPE_SECRET_KEY\n' +
      '  - STRIPE_WEBHOOK_SECRET\n' +
      '  - STRIPE_PREMIUM_PRICE_ID'
    );
  }

  return {
    secretKey: STRIPE_SECRET_KEY,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
    premiumPriceId: STRIPE_PREMIUM_PRICE_ID,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
  };
}
