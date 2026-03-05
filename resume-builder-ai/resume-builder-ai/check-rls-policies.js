#!/usr/bin/env node
/**
 * Check RLS (Row Level Security) policies for authentication-critical tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkRLSPolicies() {
  console.log('Checking RLS Policies for Authentication...\n');

  try {
    // Check if profiles table exists and is accessible
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .limit(5);

    console.log('1. PROFILES TABLE');
    if (profilesError) {
      console.log('   ❌ Error:', profilesError.message);
    } else {
      console.log('   ✅ Accessible via service role');
      console.log('   Profiles found:', profiles?.length || 0);
      if (profiles && profiles.length > 0) {
        console.log('   Sample:', profiles[0]);
      }
    }

    console.log('');

    // Test public access (without auth) - should fail with RLS
    const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: anonProfiles, error: anonError } = await anonSupabase
      .from('profiles')
      .select('id')
      .limit(1);

    console.log('2. PUBLIC ACCESS (Anon Key)');
    if (anonError) {
      if (anonError.message.includes('row-level security') || anonError.code === 'PGRST301') {
        console.log('   ✅ RLS is enabled (expected behavior - blocks unauthenticated access)');
      } else {
        console.log('   ⚠️  Error:', anonError.message);
      }
    } else {
      console.log('   ⚠️  WARNING: Public access allowed without auth!');
      console.log('   This may be a security issue if RLS should be enabled.');
    }

    console.log('');

    // Check auth.users table access
    console.log('3. AUTH USERS TABLE');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.log('   ❌ Error:', usersError.message);
    } else {
      console.log('   ✅ Auth admin API accessible');
      console.log('   Total users:', users?.users?.length || 0);
      if (users && users.users && users.users.length > 0) {
        const firstUser = users.users[0];
        console.log('   Sample user:');
        console.log('     - ID:', firstUser.id);
        console.log('     - Email:', firstUser.email);
        console.log('     - Confirmed:', firstUser.email_confirmed_at ? 'Yes' : 'No');
        console.log('     - Created:', firstUser.created_at);
      }
    }

    console.log('');

    // Check for database trigger on auth.users
    console.log('4. PROFILE CREATION TRIGGER');
    console.log('   Checking if profiles are auto-created on user signup...');

    const { data: triggerCheck, error: triggerError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT
          trigger_name,
          event_manipulation,
          event_object_table,
          action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'users'
        AND trigger_schema = 'auth'
      `
    });

    if (triggerError) {
      console.log('   ⚠️  Cannot check triggers (exec_sql RPC not available)');
      console.log('   Manual verification needed in Supabase Dashboard');
    } else {
      console.log('   ✅ Trigger query executed');
      console.log('   Results:', triggerCheck);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }

  console.log('\n=== SUMMARY ===');
  console.log('If login is failing:');
  console.log('1. Check browser console for JavaScript errors');
  console.log('2. Verify environment variables are loaded in browser');
  console.log('3. Check Network tab for failed API calls');
  console.log('4. Verify Supabase project is not paused/disabled');
  console.log('5. Check if email confirmation is required');
  console.log('===============\n');
}

checkRLSPolicies();
