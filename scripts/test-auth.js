// Test authentication setup with Supabase
// Run this with: node scripts/test-auth.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🚀 Testing Supabase Authentication Setup...\n');

// Check environment variables
console.log('Environment Check:');
console.log(`✓ Supabase URL: ${supabaseUrl ? '✅ Present' : '❌ Missing'}`);
console.log(`✓ Supabase Key: ${supabaseKey ? '✅ Present' : '❌ Missing'}`);

if (!supabaseUrl || !supabaseKey) {
  console.log('\n❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('\n🔗 Testing Supabase Connection...');
    
    // Test basic connection
    const { error } = await supabase.from('templates').select('count');
    
    if (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      
      if (error.message.includes('relation "templates" does not exist')) {
        console.log('\n📋 Database needs setup! Run the SQL script:');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Run the script: supabase/complete-setup.sql');
        return false;
      }
    } else {
      console.log('✅ Supabase connection successful');
      return true;
    }
  } catch (err) {
    console.log(`❌ Connection error: ${err.message}`);
    return false;
  }
}

async function testAuth() {
  try {
    console.log('\n🔐 Testing Auth Configuration...');
    
    // Test auth endpoint
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`❌ Auth error: ${error.message}`);
      return false;
    } else {
      console.log('✅ Auth configuration working');
      console.log(`Current session: ${session ? 'Active' : 'None'}`);
      return true;
    }
  } catch (err) {
    console.log(`❌ Auth test failed: ${err.message}`);
    return false;
  }
}

async function testPolicies() {
  try {
    console.log('\n🛡️  Testing RLS Policies...');
    
    // This should fail without authentication (good!)
    const { error } = await supabase.from('profiles').select('*');
    
    if (error && error.message.includes('RLS')) {
      console.log('✅ RLS policies are active (expected behavior)');
      return true;
    } else if (error) {
      console.log(`⚠️  Unexpected error: ${error.message}`);
      return false;
    } else {
      console.log('⚠️  RLS policies may not be working correctly');
      return false;
    }
  } catch (err) {
    console.log(`❌ Policy test failed: ${err.message}`);
    return false;
  }
}

async function runTests() {
  const connectionOk = await testConnection();
  const authOk = await testAuth();
  const policiesOk = await testPolicies();
  
  console.log('\n📊 Test Results:');
  console.log(`Connection: ${connectionOk ? '✅' : '❌'}`);
  console.log(`Auth Config: ${authOk ? '✅' : '❌'}`);
  console.log(`RLS Policies: ${policiesOk ? '✅' : '❌'}`);
  
  if (connectionOk && authOk && policiesOk) {
    console.log('\n🎉 All tests passed! Authentication setup is ready.');
  } else {
    console.log('\n🔧 Some issues found. Please check the configuration.');
  }
  
  console.log('\n🌐 Next steps:');
  console.log('1. Visit http://localhost:3000/auth/signup to test signup');
  console.log('2. Visit http://localhost:3000/auth/signin to test signin');
  console.log('3. Try accessing http://localhost:3000/dashboard (should redirect if not authenticated)');
}

runTests().catch(console.error);
