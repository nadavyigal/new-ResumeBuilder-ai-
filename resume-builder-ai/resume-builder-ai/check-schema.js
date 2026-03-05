/**
 * Check database schema details
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
  console.log('\n📋 DATABASE SCHEMA CHECK\n');
  console.log('='.repeat(70));

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check optimizations table columns
  console.log('\n1️⃣  Optimizations Table Columns:\n');

  try {
    const { data, error } = await client
      .from('optimizations')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(`   ⚠️  Error: ${error.message}\n`);
    } else if (data) {
      console.log('   Columns found in sample row:');
      Object.keys(data).forEach(col => {
        console.log(`   - ${col}: ${typeof data[col]}`);
      });
    } else {
      console.log('   ℹ️  Table is empty, trying to insert test row...\n');

      // Get column names from table metadata
      const { data: tableData, error: tableError } = await client
        .from('optimizations')
        .select()
        .limit(0);

      console.log('   Table structure:', tableData);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }

  // Check all tables structure
  console.log('\n2️⃣  All Tables in Public Schema:\n');

  const tables = [
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'chat_sessions',
    'design_templates',
    'design_customizations'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await client
        .from(table)
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && !error.message.includes('relation')) {
        console.log(`   ${table}: ❌ ${error.message}`);
      } else if (data) {
        const cols = Object.keys(data);
        console.log(`   ${table}: ✅ ${cols.length} columns - ${cols.slice(0, 5).join(', ')}${cols.length > 5 ? '...' : ''}`);
      } else {
        console.log(`   ${table}: ✅ Exists (empty)`);
      }
    } catch (err) {
      console.log(`   ${table}: ⚠️  ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Schema Check Complete!\n');
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
