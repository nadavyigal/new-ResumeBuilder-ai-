#!/usr/bin/env node
/**
 * Test Supabase connection and authentication
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'Missing');
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.log('   ⚠️  Query error (may be expected if no auth):', error.message);
    } else {
      console.log('   ✅ Connection successful!');
    }

    console.log('\n2. Testing auth service...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.log('   ❌ Session error:', sessionError.message);
    } else {
      console.log('   ✅ Auth service accessible');
      console.log('   Current session:', session ? 'Logged in' : 'Not logged in');
    }

    console.log('\n3. Testing public table access...');
    const { data: templates, error: templatesError } = await supabase
      .from('design_templates')
      .select('id, name')
      .limit(3);

    if (templatesError) {
      console.log('   ⚠️  Templates query error:', templatesError.message);
    } else {
      console.log('   ✅ Public table accessible');
      console.log('   Templates found:', templates?.length || 0);
    }

    console.log('\n4. Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies')
      .select('*');

    if (policiesError) {
      console.log('   ⚠️  Could not check policies (may not have RPC):', policiesError.message);
    }

    console.log('\n✅ Connection tests complete!');
    console.log('\nTo test login, try:');
    console.log('  supabase.auth.signInWithPassword({ email: "test@example.com", password: "password" })');

  } catch (err) {
    console.error('\n❌ Unexpected error:', err);
  }
}

testConnection();
