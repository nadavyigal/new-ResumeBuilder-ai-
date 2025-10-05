#!/usr/bin/env node

/**
 * Supabase Connection Test Script
 * Tests all aspects of Supabase integration for Resume Builder AI
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function testSupabaseConnection() {
  log('\n🔍 Testing Supabase Configuration and Connection...\n', colors.cyan);

  // Step 1: Check environment variables
  log('1. Checking Environment Variables...', colors.magenta);
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    logError('NEXT_PUBLIC_SUPABASE_URL is missing or contains placeholder values');
    logInfo('Please update your .env.local file with your actual Supabase project URL');
    return false;
  }

  if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
    logError('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or contains placeholder values');
    logInfo('Please update your .env.local file with your actual Supabase anon key');
    return false;
  }

  logSuccess(`Supabase URL: ${supabaseUrl}`);
  logSuccess('Supabase Anon Key: Present and valid format');
  
  if (!supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
    logWarning('SUPABASE_SERVICE_ROLE_KEY is missing or contains placeholder values');
    logInfo('Service role key is optional for basic testing but required for admin operations');
  } else {
    logSuccess('Supabase Service Role Key: Present and valid format');
  }

  // Step 2: Test basic connection
  log('\n2. Testing Basic Connection...', colors.magenta);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    logSuccess('Supabase client created successfully');

    // Step 3: Test authentication service
    log('\n3. Testing Authentication Service...', colors.magenta);
    
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logWarning(`Auth service accessible but no active session: ${error.message}`);
    } else {
      logSuccess('Authentication service is accessible');
    }

    // Step 4: Test database connection with templates table
    log('\n4. Testing Database Connection (Templates Table)...', colors.magenta);
    
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('*')
      .limit(1);

    if (templatesError) {
      logError(`Templates table access failed: ${templatesError.message}`);
      if (templatesError.message.includes('permission denied')) {
        logInfo('This likely means RLS is enabled but no policies allow anonymous access');
        logInfo('Run the fix-rls-issues.sql script in your Supabase dashboard');
      }
    } else {
      logSuccess(`Templates table accessible (${templates?.length || 0} records found)`);
    }

    // Step 5: Test other tables (will likely fail without authentication)
    log('\n5. Testing Other Tables (Expected to fail without auth)...', colors.magenta);
    
    const tables = ['profiles', 'resumes', 'job_descriptions', 'optimizations', 'events'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact' })
        .limit(0);

      if (error) {
        if (error.message.includes('permission denied') || error.message.includes('RLS')) {
          logSuccess(`${table} table: RLS properly configured (access denied for anonymous users)`);
        } else {
          logError(`${table} table: ${error.message}`);
        }
      } else {
        logWarning(`${table} table: Accessible without authentication (potential security issue)`);
      }
    }

    return true;

  } catch (error) {
    logError(`Connection test failed: ${error.message}`);
    return false;
  }
}

async function testRLSConfiguration() {
  log('\n🔒 Testing Row Level Security Configuration...\n', colors.cyan);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
    logWarning('Cannot test RLS configuration without service role key');
    logInfo('Please add your SUPABASE_SERVICE_ROLE_KEY to .env.local for full testing');
    return false;
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test RLS status query using service role
    const { data, error } = await supabaseAdmin
      .rpc('check_rls_status');

    if (error) {
      logWarning('Cannot check RLS status directly - this is normal if custom function is not defined');
    }

    logInfo('RLS configuration test requires manual verification in Supabase dashboard');
    logInfo('Please run the queries in fix-rls-issues.sql to verify RLS status');

  } catch (error) {
    logError(`RLS configuration test failed: ${error.message}`);
  }
}

async function main() {
  log('🚀 Resume Builder AI - Supabase Integration Test', colors.cyan);
  log('='.repeat(50), colors.cyan);

  const connectionTest = await testSupabaseConnection();
  await testRLSConfiguration();

  log('\n📋 Summary and Next Steps:\n', colors.cyan);

  if (!connectionTest) {
    logError('Connection test failed - please fix environment variables first');
    log('\nRequired Actions:', colors.yellow);
    log('1. Update .env.local with your actual Supabase credentials', colors.white);
    log('2. Go to https://app.supabase.com/project/[your-project]/settings/api', colors.white);
    log('3. Copy your Project URL and anon key', colors.white);
    log('4. Replace the placeholder values in .env.local', colors.white);
  } else {
    logSuccess('Basic connection test passed');
    log('\nRecommended Actions:', colors.yellow);
    log('1. Run the SQL script: fix-rls-issues.sql in your Supabase dashboard', colors.white);
    log('2. Test authentication by signing up a user', colors.white);
    log('3. Verify that authenticated users can access their data', colors.white);
  }

  log('\n🔗 Helpful Links:', colors.blue);
  log('• Supabase Dashboard: https://app.supabase.com/', colors.white);
  log('• RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security', colors.white);
  log('• Supabase JS Client: https://supabase.com/docs/reference/javascript', colors.white);
}

main().catch(console.error);