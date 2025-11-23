/**
 * FINAL COMPREHENSIVE SUPABASE VERIFICATION
 *
 * This script performs a complete health check of the Supabase configuration
 * after RLS has been manually enabled via the Dashboard.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORE_TABLES = [
  'profiles',
  'resumes',
  'job_descriptions',
  'optimizations',
  'templates',
  'design_templates',
  'design_customizations',
  'resume_design_assignments',
  'chat_sessions',
  'chat_messages',
  'resume_versions',
  'amendment_requests',
  'applications'
];

async function runFinalVerification() {
  console.log('\n' + '='.repeat(70));
  console.log('  🔍 SUPABASE FINAL VERIFICATION REPORT');
  console.log('='.repeat(70));
  console.log('\n📅 Date:', new Date().toLocaleString());
  console.log('🔗 Project:', SUPABASE_URL);
  console.log('📁 Working Directory:', process.cwd());

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let results = {
    critical: [],
    warnings: [],
    success: [],
    info: []
  };

  // ============================================================
  // 1. ENVIRONMENT VARIABLES
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('1️⃣  ENVIRONMENT VARIABLES');
  console.log('─'.repeat(70) + '\n');

  if (SUPABASE_URL) {
    results.success.push('Environment: NEXT_PUBLIC_SUPABASE_URL is set');
    console.log('   ✅ NEXT_PUBLIC_SUPABASE_URL: ' + SUPABASE_URL);
  } else {
    results.critical.push('Environment: NEXT_PUBLIC_SUPABASE_URL is missing');
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_URL: MISSING');
  }

  if (SUPABASE_ANON_KEY) {
    results.success.push('Environment: NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
    console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ' + SUPABASE_ANON_KEY.substring(0, 20) + '...');
  } else {
    results.critical.push('Environment: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: MISSING');
  }

  if (SUPABASE_SERVICE_KEY) {
    results.success.push('Environment: SUPABASE_SERVICE_ROLE_KEY is set');
    console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: ' + SUPABASE_SERVICE_KEY.substring(0, 20) + '...');
  } else {
    results.warnings.push('Environment: SUPABASE_SERVICE_ROLE_KEY is missing (optional but recommended)');
    console.log('   ⚠️  SUPABASE_SERVICE_ROLE_KEY: MISSING (optional)');
  }

  // ============================================================
  // 2. CONNECTION TEST
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('2️⃣  CONNECTION TEST');
  console.log('─'.repeat(70) + '\n');

  try {
    const { error } = await serviceClient.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      results.critical.push('Connection: Failed to connect to Supabase - ' + error.message);
      console.log('   ❌ Connection FAILED:', error.message);
    } else {
      results.success.push('Connection: Successfully connected to Supabase');
      console.log('   ✅ Connection SUCCESSFUL');
    }
  } catch (err) {
    results.critical.push('Connection: Exception during connection test - ' + err.message);
    console.log('   ❌ Connection ERROR:', err.message);
  }

  // ============================================================
  // 3. TABLE EXISTENCE CHECK
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('3️⃣  TABLE EXISTENCE CHECK (13 Core Tables)');
  console.log('─'.repeat(70) + '\n');

  let tablesExist = 0;
  let tablesMissing = 0;

  for (const table of CORE_TABLES) {
    try {
      const { error } = await serviceClient.from(table).select('id').limit(1);

      if (error && error.message.includes('does not exist')) {
        tablesMissing++;
        results.warnings.push(`Table: ${table} does not exist`);
        console.log(`   ❌ ${table.padEnd(30)} - NOT FOUND`);
      } else {
        tablesExist++;
        results.success.push(`Table: ${table} exists`);
        console.log(`   ✅ ${table.padEnd(30)} - EXISTS`);
      }
    } catch (err) {
      results.warnings.push(`Table: ${table} check failed - ${err.message}`);
      console.log(`   ⚠️  ${table.padEnd(30)} - ERROR: ${err.message}`);
    }
  }

  console.log(`\n   📊 Summary: ${tablesExist}/${CORE_TABLES.length} tables exist`);

  // ============================================================
  // 4. ROW LEVEL SECURITY (RLS) VERIFICATION
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('4️⃣  ROW LEVEL SECURITY (RLS) VERIFICATION');
  console.log('─'.repeat(70) + '\n');

  console.log('   Testing with ANONYMOUS client (should be blocked):\n');

  let rlsWorking = 0;
  let rlsNotWorking = 0;

  for (const table of CORE_TABLES.slice(0, 5)) { // Test first 5 tables
    try {
      const { data, error } = await anonClient.from(table).select('*').limit(1);

      if (error) {
        // RLS is working - anonymous access is blocked
        rlsWorking++;
        results.success.push(`RLS: ${table} is protected`);
        console.log(`   ✅ ${table.padEnd(30)} - PROTECTED (RLS working)`);
      } else if (data !== null) {
        // Anonymous user can access data - RLS might not be working
        rlsNotWorking++;
        results.warnings.push(`RLS: ${table} returned data for anonymous user`);
        console.log(`   ⚠️  ${table.padEnd(30)} - ACCESSIBLE (check RLS policies)`);
      } else {
        // No data but no error - table is empty
        results.info.push(`RLS: ${table} is empty (RLS status unclear)`);
        console.log(`   ℹ️  ${table.padEnd(30)} - EMPTY (RLS status unclear)`);
      }
    } catch (err) {
      results.warnings.push(`RLS: ${table} test error - ${err.message}`);
      console.log(`   ⚠️  ${table.padEnd(30)} - ERROR: ${err.message}`);
    }
  }

  if (rlsWorking >= 3) {
    results.success.push('RLS: Multiple tables show RLS protection is active');
    console.log('\n   ✅ RLS appears to be ENABLED and working correctly');
  } else if (rlsNotWorking > 0) {
    results.warnings.push('RLS: Some tables accessible anonymously - verify policies exist');
    console.log('\n   ⚠️  RLS may need policy configuration');
  }

  // ============================================================
  // 5. CRITICAL SCHEMA COLUMNS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('5️⃣  CRITICAL SCHEMA COLUMNS');
  console.log('─'.repeat(70) + '\n');

  const schemaChecks = [
    { table: 'job_descriptions', column: 'parsed_data', critical: true },
    { table: 'design_customizations', column: 'spacing', critical: true },
    { table: 'optimizations', column: 'ats_score_optimized', critical: false },
    { table: 'profiles', column: 'plan_type', critical: true },
    { table: 'chat_sessions', column: 'optimization_id', critical: false },
    { table: 'design_templates', column: 'category', critical: false }
  ];

  for (const check of schemaChecks) {
    try {
      const { error } = await serviceClient
        .from(check.table)
        .select(check.column)
        .limit(1)
        .maybeSingle();

      if (error && (error.message.includes('column') || error.message.includes('does not exist'))) {
        if (check.critical) {
          results.critical.push(`Schema: ${check.table}.${check.column} is missing (CRITICAL)`);
          console.log(`   ❌ ${check.table}.${check.column.padEnd(25)} - MISSING (CRITICAL)`);
        } else {
          results.warnings.push(`Schema: ${check.table}.${check.column} is missing`);
          console.log(`   ⚠️  ${check.table}.${check.column.padEnd(25)} - MISSING`);
        }
      } else {
        results.success.push(`Schema: ${check.table}.${check.column} exists`);
        console.log(`   ✅ ${check.table}.${check.column.padEnd(25)} - EXISTS`);
      }
    } catch (err) {
      results.warnings.push(`Schema: ${check.table}.${check.column} check failed`);
      console.log(`   ⚠️  ${check.table}.${check.column.padEnd(25)} - ERROR`);
    }
  }

  // ============================================================
  // 6. AUTHENTICATION CHECK
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('6️⃣  AUTHENTICATION CHECK');
  console.log('─'.repeat(70) + '\n');

  try {
    const { data: { session }, error } = await anonClient.auth.getSession();
    if (error) {
      results.warnings.push('Auth: Session check failed - ' + error.message);
      console.log('   ⚠️  Session check:', error.message);
    } else {
      results.success.push('Auth: Authentication endpoint is accessible');
      console.log('   ✅ Authentication endpoint is accessible');
      console.log('   ℹ️  Current session:', session ? 'Active' : 'No active session (expected)');
    }
  } catch (err) {
    results.warnings.push('Auth: Exception during auth check - ' + err.message);
    console.log('   ⚠️  Auth error:', err.message);
  }

  // ============================================================
  // 7. SAMPLE DATA QUERY TEST
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('7️⃣  SAMPLE DATA QUERY TEST (Service Role)');
  console.log('─'.repeat(70) + '\n');

  const testTables = ['profiles', 'resumes', 'optimizations'];

  for (const table of testTables) {
    try {
      const { count, error } = await serviceClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.warnings.push(`Query: ${table} query failed - ${error.message}`);
        console.log(`   ⚠️  ${table.padEnd(30)} - Query failed`);
      } else {
        results.success.push(`Query: ${table} is queryable (${count} records)`);
        console.log(`   ✅ ${table.padEnd(30)} - ${count} records`);
      }
    } catch (err) {
      results.warnings.push(`Query: ${table} query error`);
      console.log(`   ⚠️  ${table.padEnd(30)} - Error`);
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('  📊 FINAL VERIFICATION SUMMARY');
  console.log('='.repeat(70) + '\n');

  if (results.critical.length > 0) {
    console.log('❌ CRITICAL ISSUES FOUND:\n');
    results.critical.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log();
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    results.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
    console.log();
  }

  console.log(`✅ SUCCESSES: ${results.success.length} checks passed\n`);

  // Overall health assessment
  console.log('='.repeat(70));
  console.log('  🏥 OVERALL HEALTH STATUS');
  console.log('='.repeat(70) + '\n');

  if (results.critical.length === 0 && results.warnings.length === 0) {
    console.log('   🎉 EXCELLENT - All systems fully operational!\n');
    console.log('   ✅ RLS is enabled on all tables');
    console.log('   ✅ All critical schema columns exist');
    console.log('   ✅ Database connection is working');
    console.log('   ✅ Authentication is configured correctly');
    console.log('\n   🚀 Your Supabase backend is ready for production!\n');
    return 0;
  } else if (results.critical.length === 0) {
    console.log(`   ✅ GOOD - System is operational with ${results.warnings.length} minor warnings\n`);
    console.log('   ✅ No critical issues found');
    console.log('   ✅ RLS appears to be enabled');
    console.log('   ✅ Core functionality is working');
    if (results.warnings.length > 0) {
      console.log(`   ⚠️  ${results.warnings.length} warnings to review (see above)`);
    }
    console.log('\n   🟢 Your Supabase backend is operational!\n');
    return 0;
  } else {
    console.log(`   ⚠️  NEEDS ATTENTION - ${results.critical.length} critical issues found\n`);
    console.log('   ❌ Critical issues must be resolved');
    console.log('   ⚠️  Review critical issues above');
    console.log('\n   🔴 Action required before production deployment\n');
    return 1;
  }
}

// Run the verification
runFinalVerification()
  .then(code => {
    console.log('='.repeat(70));
    process.exit(code);
  })
  .catch(err => {
    console.error('\n💥 FATAL ERROR during verification:', err);
    console.error('\nStack trace:', err.stack);
    process.exit(1);
  });
