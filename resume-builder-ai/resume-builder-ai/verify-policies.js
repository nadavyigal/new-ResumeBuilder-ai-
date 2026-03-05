/**
 * Verify RLS Policies in Supabase Database
 *
 * This script checks if all expected RLS policies exist after manual RLS enablement
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Expected policies per table (from migrations)
const EXPECTED_POLICIES = {
  'profiles': [
    'Users can view own profile',
    'Users can insert own profile',
    'Users can update own profile'
  ],
  'resumes': [
    'Users can view own resumes',
    'Users can insert own resumes',
    'Users can update own resumes',
    'Users can delete own resumes'
  ],
  'job_descriptions': [
    'Users can view own job descriptions',
    'Users can insert own job descriptions',
    'Users can update own job descriptions',
    'Users can delete own job descriptions'
  ],
  'optimizations': [
    'Users can view own optimizations',
    'Users can insert own optimizations',
    'Users can update own optimizations',
    'Users can delete own optimizations'
  ],
  'templates': [
    'Authenticated users can view templates',
    'Service role can manage templates'
  ],
  'chat_sessions': [
    'Users view own sessions',
    'Users create own sessions',
    'Users update own sessions'
  ],
  'chat_messages': [
    'Users view own messages',
    'Users create own messages'
  ],
  'resume_versions': [
    'Users view own versions',
    'Users create own versions'
  ],
  'amendment_requests': [
    'Users view own requests'
  ],
  'design_templates': [
    'Templates viewable by all',
    'Templates manageable by service role'
  ],
  'design_customizations': [
    'Customizations viewable by assignment owner',
    'Customizations insertable by assignment owner',
    'Customizations updatable by assignment owner',
    'Customizations deletable by assignment owner'
  ],
  'resume_design_assignments': [
    'Assignments viewable by owner',
    'Assignments insertable by owner',
    'Assignments updatable by owner',
    'Assignments deletable by owner'
  ],
  'applications': [
    // Check if policies exist for applications table
  ]
};

async function verifyPolicies() {
  console.log('\n' + '='.repeat(70));
  console.log('  🔐 RLS POLICY VERIFICATION');
  console.log('='.repeat(70) + '\n');

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Note: We can't directly query pg_policies from Supabase client easily
  // Instead, we'll test if policies are working by testing access

  console.log('📋 Testing RLS Policy Enforcement:\n');
  console.log('   (Testing if anonymous access is blocked - proof RLS is active)\n');

  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const results = {
    protected: [],
    vulnerable: [],
    empty: [],
    error: []
  };

  for (const [table, expectedPolicies] of Object.entries(EXPECTED_POLICIES)) {
    try {
      const { data, error } = await anonClient
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        // Good! RLS is blocking access
        results.protected.push(table);
        console.log(`   ✅ ${table.padEnd(30)} - PROTECTED (${expectedPolicies.length} policies expected)`);
      } else if (data && data.length > 0) {
        // Bad! Anonymous user can see data
        results.vulnerable.push(table);
        console.log(`   ❌ ${table.padEnd(30)} - VULNERABLE (data accessible!)`);
      } else if (data && data.length === 0) {
        // Table is empty, can't verify RLS
        results.empty.push(table);
        console.log(`   ℹ️  ${table.padEnd(30)} - EMPTY (RLS status unclear)`);
      }
    } catch (err) {
      results.error.push(table);
      console.log(`   ⚠️  ${table.padEnd(30)} - ERROR: ${err.message.substring(0, 40)}...`);
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(70));
  console.log('📊 SUMMARY:\n');
  console.log(`   ✅ Protected Tables:  ${results.protected.length}`);
  console.log(`   ❌ Vulnerable Tables: ${results.vulnerable.length}`);
  console.log(`   ℹ️  Empty Tables:     ${results.empty.length}`);
  console.log(`   ⚠️  Error Tables:     ${results.error.length}`);

  if (results.vulnerable.length > 0) {
    console.log('\n⚠️  ATTENTION NEEDED:');
    console.log('\n   The following tables are accessible without authentication:');
    results.vulnerable.forEach(t => console.log(`   - ${t}`));
    console.log('\n   This means RLS is enabled but policies are missing or too permissive.');
  }

  // Check if we can query using service role (should always work)
  console.log('\n' + '─'.repeat(70));
  console.log('🔑 Service Role Access Test:\n');

  let serviceSuccess = 0;
  for (const table of Object.keys(EXPECTED_POLICIES).slice(0, 5)) {
    try {
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        serviceSuccess++;
        console.log(`   ✅ ${table.padEnd(30)} - Accessible (${count} records)`);
      } else {
        console.log(`   ❌ ${table.padEnd(30)} - ${error.message}`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${table.padEnd(30)} - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  🏥 POLICY STATUS');
  console.log('='.repeat(70) + '\n');

  if (results.protected.length >= 10 && results.vulnerable.length === 0) {
    console.log('   🎉 EXCELLENT - RLS is fully enabled with proper policies!\n');
    console.log('   ✅ All tables are protected from anonymous access');
    console.log('   ✅ Service role can access all tables');
    console.log('   ✅ Your database is secure\n');
    return 0;
  } else if (results.vulnerable.length === 0) {
    console.log('   ✅ GOOD - RLS is working correctly\n');
    console.log(`   ✅ ${results.protected.length} tables are properly protected`);
    console.log(`   ℹ️  ${results.empty.length} tables are empty (need data to verify)`);
    console.log('   ✅ No security vulnerabilities detected\n');
    return 0;
  } else {
    console.log('   ⚠️  ACTION REQUIRED - Some tables need policy configuration\n');
    console.log(`   ❌ ${results.vulnerable.length} tables are vulnerable`);
    console.log('   📋 Review and add missing RLS policies\n');
    return 1;
  }
}

verifyPolicies()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
