/**
 * Apply the feedback_tables migration to the production Supabase project.
 * Run: node scripts/apply-feedback-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Split SQL respecting $$ blocks (used in functions/triggers)
function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) {
      continue; // skip comment lines
    }
    current += line + '\n';

    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }

    if (!inDollarQuote && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt.length > 1) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements.filter((s) => s.length > 0);
}

async function tryRPC(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  return { data, error };
}

async function tryManagementAPI(sql) {
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) return { error: { message: 'Could not determine project ref' } };

  // Try Supabase Management API (requires service_role as bearer in some configurations)
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({ sql }),
    }
  );

  if (!response.ok) {
    return { error: { message: await response.text() } };
  }

  return { data: await response.json(), error: null };
}

async function verifyTables() {
  const results = {};

  for (const table of ['feedback', 'support_tickets']) {
    const { error } = await supabase.from(table).select('id').limit(0);
    results[table] = !error;
  }

  return results;
}

async function main() {
  console.log('🔗 Supabase project:', supabaseUrl);
  console.log('');

  // First check if tables already exist
  console.log('🔍 Checking if tables already exist...');
  const existing = await verifyTables();

  if (existing.feedback && existing.support_tickets) {
    console.log('✅ Tables already exist! Migration was previously applied.');
    console.log('   feedback: ✅');
    console.log('   support_tickets: ✅');
    process.exit(0);
  }

  const migrationPath = path.join(
    __dirname, '..', 'supabase', 'migrations', '20260218211757_feedback_tables.sql'
  );

  console.log('📋 Reading migration:', migrationPath);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  const statements = splitSQL(migrationSQL);
  console.log(`   Found ${statements.length} SQL statements\n`);

  // Try full migration via exec_sql RPC
  console.log('🚀 Attempting to apply migration via exec_sql RPC...');
  const { error: rpcError } = await tryRPC(migrationSQL);

  if (!rpcError) {
    console.log('✅ Migration applied via exec_sql RPC!\n');
  } else {
    console.log('⚠️  exec_sql RPC not available:', rpcError.message);
    console.log('   Trying Management API...\n');

    const { error: apiError } = await tryManagementAPI(migrationSQL);

    if (!apiError) {
      console.log('✅ Migration applied via Management API!\n');
    } else {
      console.log('⚠️  Management API also unavailable:', apiError.message);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 MANUAL MIGRATION REQUIRED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('1. Open your Supabase SQL Editor:');
      console.log(`   ${supabaseUrl.replace('.supabase.co', '.supabase.co')}/dashboard/sql`);
      console.log('');
      console.log('2. Or go to:');
      console.log('   https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/sql');
      console.log('');
      console.log('3. Paste and run this SQL:\n');
      console.log(migrationSQL);
      console.log('');
      process.exit(0);
    }
  }

  // Verify tables
  console.log('🔍 Verifying tables were created...');
  const verification = await verifyTables();

  for (const [table, exists] of Object.entries(verification)) {
    console.log(`   ${table}: ${exists ? '✅' : '❌'}`);
  }

  if (Object.values(verification).every(Boolean)) {
    console.log('\n✅ All tables verified successfully!');
  } else {
    console.log('\n⚠️  Some tables may not have been created — run the SQL manually.');
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
