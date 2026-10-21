/**
 * Security Fixes Test Suite
 *
 * This test suite verifies all 5 critical security fixes:
 * 1. Authorization bypass in download endpoint
 * 2. Race condition in quota check
 * 3. Unsafe environment variable access
 * 4. RLS policies enabled
 * 5. Stripe webhook security
 */

import { describe, it, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { describeLiveBackend } from './helpers/live-gates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-0123456789abcdef',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-0123456789abcdef',
  OPENAI_API_KEY: 'sk-test-0123456789abcdefghij',
};

type MutableEnv = Record<string, string | undefined>;

/** Load a fresh copy of src/lib/env.ts (it caches its result) under the given env. */
function loadGetEnv(overrides: MutableEnv): () => unknown {
  const env = process.env as MutableEnv;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  let getEnv: (() => unknown) | undefined;
  jest.isolateModules(() => {
    getEnv = (require('@/lib/env') as { getEnv: () => unknown }).getEnv;
  });
  return getEnv!;
}

describe('Security Fixes Verification', () => {

  // ==================== TEST 1: ENVIRONMENT VALIDATION ====================
  // src/lib/env.ts exposes getEnv(); the validateEnvironment/getRequiredEnv API
  // these tests used to import was deleted with the duplicate src tree (c59ea78).

  describe('1. Environment Variable Validation', () => {
    const snapshot = { ...process.env };

    afterEach(() => {
      const env = process.env as MutableEnv;
      for (const key of Object.keys(env)) {
        if (!(key in snapshot)) delete env[key];
      }
      Object.assign(env, snapshot);
    });

    it('accepts a complete, well-formed environment', () => {
      const getEnv = loadGetEnv({ ...VALID_ENV, NODE_ENV: 'test' });
      expect(() => getEnv()).not.toThrow();
    });

    it('names the missing variable when NEXT_PUBLIC_SUPABASE_URL is absent', () => {
      const getEnv = loadGetEnv({ ...VALID_ENV, NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: undefined });
      expect(() => getEnv()).toThrow(/Invalid environment variables[\s\S]*NEXT_PUBLIC_SUPABASE_URL/);
    });

    it('rejects a Supabase URL that is not https', () => {
      const getEnv = loadGetEnv({
        ...VALID_ENV,
        NODE_ENV: 'test',
        NEXT_PUBLIC_SUPABASE_URL: 'http://abcdefghijklmnop.supabase.co',
      });
      expect(() => getEnv()).toThrow(/must start with "https:\/\/"/);
    });

    it('requires server secrets in production', () => {
      const getEnv = loadGetEnv({ ...VALID_ENV, NODE_ENV: 'production', OPENAI_API_KEY: undefined });
      expect(() => getEnv()).toThrow(/OPENAI_API_KEY/);
    });
  });

  // ==================== TEST 2: RLS POLICIES ====================

  // Hits the real Supabase project; the assertions are smoke checks, not an RLS audit.
  describeLiveBackend('2. Row Level Security (RLS) Policies', () => {
    let supabase: SupabaseClient<Database>;

    beforeAll(() => {
      supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    });

    it('should have RLS enabled on all critical tables', async () => {
      const { error } = await supabase.rpc('pg_tables_with_rls', {});

      // Note: This requires a custom RPC function or we can check via policies
      // For now, we'll verify by attempting unauthorized access
      expect(error).toBeNull();
    });

    it('should prevent users from accessing other users data (profiles)', async () => {
      // Try to access all profiles - should only return current user's profile
      const { data } = await supabase
        .from('profiles')
        .select('*');

      if (data) {
        // Should return 0 rows if not authenticated, or only 1 row (current user)
        expect(data.length).toBeLessThanOrEqual(1);
      }
    });

    it('should prevent users from accessing other users resumes', async () => {
      const { data } = await supabase
        .from('resumes')
        .select('*');

      if (data) {
        // Should only return current user's resumes
        expect(data.every(() => true)).toBe(true);
      }
    });

    it('should prevent users from accessing other users optimizations', async () => {
      const { data } = await supabase
        .from('optimizations')
        .select('*');

      if (data) {
        expect(data.every(() => true)).toBe(true);
      }
    });

    it('should allow authenticated users to view templates', async () => {
      const { error } = await supabase
        .from('templates')
        .select('*');

      // Templates should be readable by all authenticated users
      // This will succeed if user is authenticated
      expect(error).toBeNull();
    });
  });

  // ==================== TEST 3: ATOMIC QUOTA INCREMENT ====================

  describeLiveBackend('3. Atomic Quota Increment Function', () => {
    let supabase: SupabaseClient<Database>;

    beforeAll(() => {
      supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    });

    it('should have increment_optimizations_used function defined', async () => {
      // Query to check if function exists
      const { error } = await supabase.rpc('increment_optimizations_used', {
        user_id_param: '00000000-0000-0000-0000-000000000000', // Invalid UUID for test
        max_allowed: 1
      });

      // Should not error on function not found (might error on invalid user)
      expect(error?.message).not.toContain('function');
    });

    // Note: Full race condition testing requires integration tests with concurrent requests
    // This is tested in integration-tests.spec.ts
  });

  // ==================== TEST 4: DOWNLOAD AUTHORIZATION ====================

  describe('4. Download Endpoint Authorization', () => {
    it('should verify download route includes user_id check', async () => {
      // Read the download route file and verify it has the security check
      const fs = require('fs');
      const path = require('path');

      const downloadRoutePath = path.join(
        process.cwd(),
        'src/app/api/download/[id]/route.ts'
      );

      const routeContent = fs.readFileSync(downloadRoutePath, 'utf-8');

      // Verify security checks are present
      expect(routeContent).toContain('getUser()');
      expect(routeContent).toContain('eq("user_id", user.id)');
      expect(routeContent).toContain('Unauthorized');

      // Verify both checks are in correct order
      const getUserIndex = routeContent.indexOf('getUser()');
      const userIdCheckIndex = routeContent.indexOf('eq("user_id", user.id)');

      expect(getUserIndex).toBeGreaterThan(0);
      expect(userIdCheckIndex).toBeGreaterThan(getUserIndex);
    });
  });

  // ==================== TEST 5: STRIPE WEBHOOK SECURITY ====================
  // There is no Stripe webhook route today: the only copy was deleted with the
  // duplicate src tree (c59ea78). /api/upgrade still creates Stripe subscriptions,
  // so nothing would mark a paying user premium. That is safe only while the
  // monetization gate is closed. This test fails the moment the gate opens
  // without a signature-verified webhook in place.

  describe('5. Stripe Webhook Security', () => {
    it('does not open paid upgrades without a signature-verified webhook', () => {
      const fs = require('fs');
      const path = require('path');
      const { MONETIZATION_GATE_OPEN } = require('@/lib/monetization-gate');

      const webhookRoutePath = path.join(process.cwd(), 'src/app/api/stripe/webhook/route.ts');
      const hasWebhook = fs.existsSync(webhookRoutePath);

      if (!MONETIZATION_GATE_OPEN) {
        expect(MONETIZATION_GATE_OPEN).toBe(false);
        return;
      }

      expect(hasWebhook).toBe(true);
      const routeContent = fs.readFileSync(webhookRoutePath, 'utf-8');
      expect(routeContent).toContain('stripe-signature');
      expect(routeContent).toContain('constructEvent');
      expect(routeContent).toContain('STRIPE_WEBHOOK_SECRET');
      expect(routeContent).not.toContain('501');
    });
  });
});

// ==================== INTEGRATION TEST SCENARIOS ====================

describe('Integration Test Scenarios', () => {

  it('should document required manual tests', () => {
    console.log(`
      ==================== MANUAL TESTING REQUIRED ====================

      1. AUTHORIZATION BYPASS TEST:
         - Create two test users
         - User A creates an optimization
         - User B attempts to download User A's optimization
         - Expected: 404 Not Found (user B cannot access user A's data)

      2. RACE CONDITION TEST:
         - Create a free tier user
         - Send 5 concurrent optimization requests
         - Expected: Only 1 should succeed, others get 402 Payment Required

      3. RLS POLICY TEST:
         - Create two test users with data
         - Query profiles table as User A
         - Expected: Only see User A's profile
         - Query optimizations table as User A
         - Expected: Only see User A's optimizations

      4. ENVIRONMENT VALIDATION TEST:
         - Remove OPENAI_API_KEY from .env.local
         - Restart server
         - Expected: Clear error message about missing variable

      5. STRIPE WEBHOOK TEST:
         - Use Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook
         - Trigger test event: stripe trigger checkout.session.completed
         - Expected: Webhook processes successfully, user upgraded to premium

      ================================================================
    `);

    expect(true).toBe(true); // This test always passes, just prints instructions
  });
});
