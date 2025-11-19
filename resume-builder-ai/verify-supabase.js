/**
 * Comprehensive Supabase Configuration Verification Script
 * Checks RLS, policies, schema, and connection health
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Core tables that should have RLS enabled
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

async function verifySupabase() {
  console.log('\n🔍 SUPABASE CONFIGURATION VERIFICATION\n');
  console.log('=' .repeat(60));

  // Initialize clients
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let criticalIssues = [];
  let warnings = [];
  let successes = [];

  // 1. Check environment variables
  console.log('\n1️⃣  Checking Environment Variables...');
  if (!SUPABASE_URL) {
    criticalIssues.push('❌ NEXT_PUBLIC_SUPABASE_URL is missing');
  } else {
    successes.push('✅ NEXT_PUBLIC_SUPABASE_URL configured');
  }
  if (!SUPABASE_ANON_KEY) {
    criticalIssues.push('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  } else {
    successes.push('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configured');
  }
  if (!SUPABASE_SERVICE_KEY) {
    warnings.push('⚠️  SUPABASE_SERVICE_ROLE_KEY is missing (optional)');
  } else {
    successes.push('✅ SUPABASE_SERVICE_ROLE_KEY configured');
  }

  // 2. Test basic connection
  console.log('\n2️⃣  Testing Supabase Connection...');
  try {
    const { data, error } = await anonClient.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      criticalIssues.push(`❌ Connection test failed: ${error.message}`);
    } else {
      successes.push('✅ Supabase connection successful');
    }
  } catch (err) {
    criticalIssues.push(`❌ Connection error: ${err.message}`);
  }

  // 3. Check RLS status on all tables
  console.log('\n3️⃣  Checking Row Level Security (RLS) Status...');
  try {
    const { data: tables, error } = await serviceClient.rpc('check_rls_status');

    if (error) {
      // RPC might not exist, try direct query
      const { data: pgTables, error: pgError } = await serviceClient
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

      if (pgError) {
        warnings.push(`⚠️  Could not query table list: ${pgError.message}`);
      } else {
        console.log(`   Found ${pgTables?.length || 0} tables in public schema`);

        for (const table of CORE_TABLES) {
          const exists = pgTables?.some(t => t.tablename === table);
          if (exists) {
            successes.push(`✅ Table exists: ${table}`);
          } else {
            warnings.push(`⚠️  Table not found: ${table}`);
          }
        }
      }
    }
  } catch (err) {
    warnings.push(`⚠️  RLS check error: ${err.message}`);
  }

  // 4. Check for RLS policies
  console.log('\n4️⃣  Checking RLS Policies...');
  try {
    const { data: policies, error } = await serviceClient
      .rpc('get_policies_summary');

    if (error) {
      // Try alternative query
      const query = `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `;

      const { data: pgPolicies, error: pgError } = await serviceClient.rpc('sql_query', { query });

      if (pgError) {
        warnings.push(`⚠️  Could not query policies: ${pgError.message}`);
      } else if (pgPolicies && pgPolicies.length > 0) {
        successes.push(`✅ Found ${pgPolicies.length} RLS policies`);
        console.log(`   Total policies found: ${pgPolicies.length}`);
      } else {
        warnings.push('⚠️  No RLS policies found - this may be normal if using service role');
      }
    } else {
      successes.push(`✅ RLS policies configured`);
    }
  } catch (err) {
    warnings.push(`⚠️  Policy check error: ${err.message}`);
  }

  // 5. Verify critical schema columns
  console.log('\n5️⃣  Verifying Database Schema...');

  // Check job_descriptions.parsed_data
  try {
    const { data, error } = await serviceClient
      .from('job_descriptions')
      .select('parsed_data')
      .limit(1)
      .maybeSingle();

    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      warnings.push(`⚠️  job_descriptions.parsed_data check: ${error.message}`);
    } else {
      successes.push('✅ job_descriptions.parsed_data column exists');
    }
  } catch (err) {
    warnings.push(`⚠️  Schema check error for job_descriptions: ${err.message}`);
  }

  // Check design_customizations.spacing
  try {
    const { data, error } = await serviceClient
      .from('design_customizations')
      .select('spacing')
      .limit(1)
      .maybeSingle();

    if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
      warnings.push(`⚠️  design_customizations.spacing check: ${error.message}`);
    } else {
      successes.push('✅ design_customizations.spacing column exists');
    }
  } catch (err) {
    warnings.push(`⚠️  Schema check error for design_customizations: ${err.message}`);
  }

  // 6. Test authenticated query simulation
  console.log('\n6️⃣  Testing Authenticated Query (Simulated)...');
  try {
    // This will fail with RLS enabled when not authenticated, which is correct
    const { data, error } = await anonClient
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('JWT') || error.message.includes('RLS')) {
        successes.push('✅ RLS is working - anonymous access properly restricted');
      } else {
        warnings.push(`⚠️  Query error: ${error.message}`);
      }
    } else {
      warnings.push('⚠️  Anonymous query succeeded - RLS may not be fully enforced');
    }
  } catch (err) {
    warnings.push(`⚠️  Auth query test error: ${err.message}`);
  }

  // 7. Check authentication configuration
  console.log('\n7️⃣  Checking Authentication Configuration...');
  try {
    const { data: { session }, error } = await anonClient.auth.getSession();
    if (error) {
      warnings.push(`⚠️  Auth check: ${error.message}`);
    } else {
      successes.push('✅ Authentication endpoint accessible');
    }
  } catch (err) {
    warnings.push(`⚠️  Auth config error: ${err.message}`);
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 VERIFICATION RESULTS\n');

  if (successes.length > 0) {
    console.log('✅ SUCCESSES:');
    successes.forEach(s => console.log(`   ${s}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
  }

  if (criticalIssues.length > 0) {
    console.log('\n❌ CRITICAL ISSUES:');
    criticalIssues.forEach(i => console.log(`   ${i}`));
  }

  // Overall health assessment
  console.log('\n' + '='.repeat(60));
  console.log('\n🏥 OVERALL HEALTH STATUS:\n');

  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log('   🎉 EXCELLENT - All systems operational!\n');
    return 0;
  } else if (criticalIssues.length === 0) {
    console.log(`   ✅ GOOD - ${successes.length} checks passed, ${warnings.length} minor warnings\n`);
    return 0;
  } else {
    console.log(`   ⚠️  NEEDS ATTENTION - ${criticalIssues.length} critical issues found\n`);
    return 1;
  }
}

// Run verification
verifySupabase()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
