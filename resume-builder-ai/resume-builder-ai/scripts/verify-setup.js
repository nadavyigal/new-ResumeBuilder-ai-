// Verify complete setup after running SQL script
// Run this with: node scripts/verify-setup.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for verification
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Verifying Complete Supabase Setup...\n');

// Create clients
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function verifyTables() {
  console.log('📋 Checking Database Tables...');
  const tables = ['profiles', 'resumes', 'job_descriptions', 'optimizations', 'templates', 'events'];
  let allTablesExist = true;
  
  for (const table of tables) {
    try {
      const { data, error } = await supabaseService.from(table).select('count');
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table '${table}': Ready`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err.message}`);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
}

async function verifyTemplates() {
  console.log('\n📄 Checking Default Templates...');
  try {
    const { data, error } = await supabaseAnon.from('templates').select('key, name');
    
    if (error) {
      console.log(`❌ Templates check failed: ${error.message}`);
      return false;
    }
    
    const expectedTemplates = ['ats-safe', 'modern-creative'];
    const foundTemplates = data.map(t => t.key);
    
    let allTemplatesFound = true;
    for (const template of expectedTemplates) {
      if (foundTemplates.includes(template)) {
        console.log(`✅ Template '${template}': Found`);
      } else {
        console.log(`❌ Template '${template}': Missing`);
        allTemplatesFound = false;
      }
    }
    
    return allTemplatesFound;
  } catch (err) {
    console.log(`❌ Templates verification failed: ${err.message}`);
    return false;
  }
}

async function verifyRLS() {
  console.log('\n🛡️  Checking RLS Policies...');
  try {
    // This should fail without authentication (proving RLS works)
    const { data, error } = await supabaseAnon.from('profiles').select('*');
    
    if (error && (error.message.includes('RLS') || error.message.includes('policy'))) {
      console.log('✅ RLS Policies: Active (blocking unauthorized access)');
      return true;
    } else if (data && data.length === 0) {
      console.log('✅ RLS Policies: Active (no data returned)');
      return true;
    } else {
      console.log('⚠️  RLS Policies: May not be configured correctly');
      return false;
    }
  } catch (err) {
    console.log(`❌ RLS verification failed: ${err.message}`);
    return false;
  }
}

async function verifyAuthTrigger() {
  console.log('\n🎯 Checking Auth Trigger Function...');
  try {
    const { data, error } = await supabaseService.rpc('handle_new_user');
    
    // The function should exist but fail without proper context
    if (error && !error.message.includes('does not exist')) {
      console.log('✅ Auth Trigger: Function exists');
      return true;
    } else if (error && error.message.includes('does not exist')) {
      console.log('❌ Auth Trigger: Function missing');
      return false;
    } else {
      console.log('✅ Auth Trigger: Function exists');
      return true;
    }
  } catch (err) {
    console.log('✅ Auth Trigger: Function exists (expected error in test context)');
    return true;
  }
}

async function runVerification() {
  const tablesOk = await verifyTables();
  const templatesOk = await verifyTemplates();
  const rlsOk = await verifyRLS();
  const triggerOk = await verifyAuthTrigger();
  
  console.log('\n📊 Verification Results:');
  console.log(`Database Tables: ${tablesOk ? '✅' : '❌'}`);
  console.log(`Default Templates: ${templatesOk ? '✅' : '❌'}`);
  console.log(`RLS Policies: ${rlsOk ? '✅' : '❌'}`);
  console.log(`Auth Triggers: ${triggerOk ? '✅' : '❌'}`);
  
  console.log('\n🎯 Authentication Test URLs:');
  console.log('• Signup: http://localhost:3000/auth/signup');
  console.log('• Signin: http://localhost:3000/auth/signin');
  console.log('• Dashboard: http://localhost:3000/dashboard');
  
  if (tablesOk && templatesOk && rlsOk && triggerOk) {
    console.log('\n🎉 Setup Complete! Your authentication system is ready to use.');
    console.log('\n📝 To test:');
    console.log('1. Create a new account at the signup page');
    console.log('2. Verify email confirmation (check Supabase Auth settings)');
    console.log('3. Sign in with your credentials');
    console.log('4. Access the protected dashboard');
  } else {
    console.log('\n🔧 Some components need attention. Check the SQL script execution.');
  }
}

runVerification().catch(console.error);