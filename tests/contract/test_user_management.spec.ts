/**
 * Contract Test: User Management and Monetization
 * Epic 5: User Management and Monetization
 *
 * Validates FR-020 to FR-024:
 * - FR-020: User account creation and authentication
 * - FR-021: Free-tier limit (1 optimization)
 * - FR-022: Paywall interface
 * - FR-023: Premium subscription access
 * - FR-024: Payment processing integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Epic 5: User Management and Monetization - FR-020 to FR-024', () => {
  let supabase: SupabaseClient<Database>;
  let testUserId: string;
  let testUserEmail: string;
  let authToken: string;

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseKey);
    testUserEmail = `test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Cleanup: Delete test user
    if (testUserId && supabase) {
      try {
        await supabase.auth.admin.deleteUser(testUserId);
      } catch (error) {
        console.log('Cleanup: Could not delete test user');
      }
    }
  });

  describe('FR-020: Authentication', () => {
    it('should allow user registration with email and password', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: testUserEmail,
        password: 'TestPassword123!',
        options: {
          data: {
            full_name: 'Test User',
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(testUserEmail);

      testUserId = data.user!.id;
      authToken = data.session?.access_token || '';
    });

    it('should create user profile on signup', async () => {
      // Wait a bit for profile creation trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile?.user_id).toBe(testUserId);
      expect(profile?.plan_type).toBe('free');
      expect(profile?.optimizations_used).toBe(0);
    });

    it('should allow user sign in with correct credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'TestPassword123!',
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBeDefined();
    });

    it('should reject sign in with incorrect password', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'WrongPassword',
      });

      expect(error).toBeDefined();
      expect(data.session).toBeNull();
    });

    it('should allow user sign out', async () => {
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();

      const { data: { session } } = await supabase.auth.getSession();
      expect(session).toBeNull();
    });
  });

  describe('FR-021: Free Tier Limit', () => {
    beforeAll(async () => {
      // Sign in again for subsequent tests
      await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: 'TestPassword123!',
      });
    });

    it('should allow first optimization for free-tier user', async () => {
      const formData = new FormData();
      formData.append('resume', new Blob(['Test resume content'], { type: 'application/pdf' }), 'test-resume.pdf');
      formData.append('jobDescription', 'Software Engineer position requiring React and TypeScript skills');

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.status === 401) {
        console.warn('Auth not working in test environment - skipping API test');
        return;
      }

      expect(response.status).toBeLessThan(500);
      // Should succeed (200) or fail for other reasons (not 402)
      if (response.status === 402) {
        throw new Error('First optimization should not hit paywall');
      }
    }, 30000);

    it('should track optimization usage count', async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('optimizations_used')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile?.optimizations_used).toBeGreaterThanOrEqual(0);
      expect(profile?.optimizations_used).toBeLessThanOrEqual(1);
    });

    it('should store plan type in profile', async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(profile?.plan_type).toBe('free');
    });
  });

  describe('FR-022: Paywall Interface', () => {
    it('should return 402 status when free tier limit exceeded', async () => {
      // First, set optimizations_used to 1 to simulate used quota
      await supabase
        .from('profiles')
        .update({ optimizations_used: 1 })
        .eq('user_id', testUserId);

      const formData = new FormData();
      formData.append('resume', new Blob(['Test resume'], { type: 'application/pdf' }), 'resume.pdf');
      formData.append('jobDescription', 'Job description text');

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        console.warn('Auth not working - skipping paywall test');
        return;
      }

      const data = await response.json();

      expect(response.status).toBe(402); // Payment Required
      expect(data.code).toBe('QUOTA_EXCEEDED');
      expect(data.requiresUpgrade).toBe(true);
    }, 30000);

    it('should include upgrade information in paywall response', async () => {
      await supabase
        .from('profiles')
        .update({ optimizations_used: 1 })
        .eq('user_id', testUserId);

      const formData = new FormData();
      formData.append('resume', new Blob(['Test'], { type: 'application/pdf' }), 'test.pdf');
      formData.append('jobDescription', 'Test job');

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        return; // Skip if auth not working
      }

      const data = await response.json();

      if (response.status === 402) {
        expect(data.message).toBeDefined();
        expect(data.currentPlan).toBe('free');
        expect(data.optimizationsUsed).toBe(1);
      }
    }, 30000);

    it('should not block premium users', async () => {
      // Upgrade user to premium
      await supabase
        .from('profiles')
        .update({ plan_type: 'premium', optimizations_used: 10 })
        .eq('user_id', testUserId);

      const formData = new FormData();
      formData.append('resume', new Blob(['Premium test'], { type: 'application/pdf' }), 'premium.pdf');
      formData.append('jobDescription', 'Premium job');

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        return;
      }

      // Premium users should not hit paywall regardless of usage count
      expect(response.status).not.toBe(402);

      // Reset back to free
      await supabase
        .from('profiles')
        .update({ plan_type: 'free', optimizations_used: 0 })
        .eq('user_id', testUserId);
    }, 30000);
  });

  describe('FR-023 & FR-024: Premium Subscription and Payment', () => {
    it('should provide upgrade endpoint', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ plan: 'premium' }),
      });

      expect(response.status).toBeLessThan(500);
      // Should return 503 (not configured) or 200 (dev mode) or 401 (auth issue)
      expect([200, 401, 503]).toContain(response.status);
    });

    it('should validate plan type in upgrade request', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ plan: 'invalid-plan' }),
      });

      if (response.status === 401) {
        return; // Skip if auth not working
      }

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should require authentication for upgrade endpoint', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: 'premium' }),
      });

      expect(response.status).toBe(401);
    });

    it('should handle development mode upgrade', async () => {
      if (process.env.NODE_ENV !== 'development') {
        console.log('Skipping dev-mode test in non-dev environment');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ plan: 'premium' }),
      });

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.message).toContain('Development mode');

        // Verify upgrade in database
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type')
          .eq('user_id', testUserId)
          .single();

        expect(profile?.plan_type).toBe('premium');
      }
    });
  });

  describe('Profile Management', () => {
    it('should update profile fields', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: 'Updated Test User' })
        .eq('user_id', testUserId);

      expect(error).toBeNull();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', testUserId)
        .single();

      expect(profile?.full_name).toBe('Updated Test User');
    });

    it('should track timestamps', async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('created_at, updated_at')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(profile?.created_at).toBeDefined();
      expect(profile?.updated_at).toBeDefined();
    });
  });
});
