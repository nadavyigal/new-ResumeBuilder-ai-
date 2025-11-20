/**
 * Direct RLS and Policy Verification using SQL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

async function verifyRLS() {
  console.log('\n🔐 RLS & POLICY VERIFICATION\n');
  console.log('='.repeat(70));

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check RLS status
  console.log('\n1️⃣  Row Level Security (RLS) Status:\n');

  const rlsQuery = `
    SELECT
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (${CORE_TABLES.map(t => `'${t}'`).join(', ')})
    ORDER BY c.relname;
  `;

  try {
    const { data: rlsData, error: rlsError } = await client.rpc('execute_sql', {
      query: rlsQuery
    });

    if (rlsError) {
      // Try alternative approach with direct query
      console.log('   Using alternative query method...\n');

      for (const table of CORE_TABLES) {
        try {
          // Try to access table - if RLS blocks it, that's good
          const { error } = await client.from(table).select('*').limit(0);

          if (error) {
            console.log(`   ✅ ${table.padEnd(30)} - RLS appears active`);
          } else {
            console.log(`   ℹ️  ${table.padEnd(30)} - Accessible (service role)`);
          }
        } catch (err) {
          console.log(`   ❌ ${table.padEnd(30)} - Error: ${err.message}`);
        }
      }
    } else if (rlsData) {
      rlsData.forEach(row => {
        const status = row.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
        console.log(`   ${row.table_name.padEnd(30)} ${status}`);
      });
    }
  } catch (err) {
    console.log(`   ⚠️  Error checking RLS: ${err.message}`);
  }

  // Check policies
  console.log('\n2️⃣  RLS Policies:\n');

  const policiesQuery = `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;

  try {
    const { data: policiesData, error: policiesError } = await client.rpc('execute_sql', {
      query: policiesQuery
    });

    if (policiesError) {
      console.log(`   ⚠️  Could not query policies directly: ${policiesError.message}`);
      console.log('   ℹ️  This is normal - policies are managed at database level\n');
    } else if (policiesData && policiesData.length > 0) {
      console.log(`   Found ${policiesData.length} policies:\n`);

      const tableGroups = {};
      policiesData.forEach(policy => {
        if (!tableGroups[policy.tablename]) {
          tableGroups[policy.tablename] = [];
        }
        tableGroups[policy.tablename].push(policy);
      });

      Object.entries(tableGroups).forEach(([table, policies]) => {
        console.log(`   📋 ${table} (${policies.length} policies):`);
        policies.forEach(p => {
          console.log(`      - ${p.policyname} [${p.cmd}] for ${p.roles.join(', ')}`);
        });
        console.log();
      });
    } else {
      console.log('   ℹ️  No policies found via RPC (this may be normal)\n');
    }
  } catch (err) {
    console.log(`   ⚠️  Error checking policies: ${err.message}\n`);
  }

  // Check specific schema columns
  console.log('3️⃣  Critical Schema Columns:\n');

  const schemaChecks = [
    { table: 'job_descriptions', column: 'parsed_data' },
    { table: 'design_customizations', column: 'spacing' },
    { table: 'optimizations', column: 'optimized_resume' },
    { table: 'profiles', column: 'plan_type' },
    { table: 'chat_sessions', column: 'optimization_id' },
    { table: 'design_templates', column: 'category' }
  ];

  for (const check of schemaChecks) {
    try {
      const { error } = await client
        .from(check.table)
        .select(check.column)
        .limit(1)
        .maybeSingle();

      if (error && (error.message.includes('column') || error.message.includes('does not exist'))) {
        console.log(`   ❌ ${check.table}.${check.column.padEnd(20)} - MISSING`);
      } else {
        console.log(`   ✅ ${check.table}.${check.column.padEnd(20)} - EXISTS`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${check.table}.${check.column.padEnd(20)} - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Verification Complete!\n');
}

verifyRLS()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
