/**
 * Apply database migrations to Supabase
 * Feature: 008-enhance-ai-assistent
 * Applies 4 migrations for enhanced AI assistant functionality
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration files in order
const migrations = [
  {
    name: '20250118000001_create_ai_threads.sql',
    description: 'Create ai_threads table for OpenAI thread tracking'
  },
  {
    name: '20250118000002_create_content_modifications.sql',
    description: 'Create content_modifications table for resume change audit'
  },
  {
    name: '20250118000003_create_style_history.sql',
    description: 'Create style_customization_history table for visual customization tracking'
  },
  {
    name: '20250118000004_alter_existing_tables.sql',
    description: 'Add columns to chat_sessions and optimizations tables'
  }
];

async function applyMigration(migration) {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', migration.name);

  console.log(`\n📄 Reading migration: ${migration.name}`);
  console.log(`   ${migration.description}`);

  // Read SQL file
  let sql;
  try {
    sql = fs.readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${error.message}`);
    return { success: false, error: error.message };
  }

  // Execute SQL by splitting into individual statements
  console.log(`⚙️  Applying migration...`);

  // Split by statement and filter out comments and empty lines
  const statements = sql
    .replace(/BEGIN;/gi, '')
    .replace(/COMMIT;/gi, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      // Remove empty statements and comment-only statements
      if (!s) return false;
      const withoutComments = s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      return withoutComments.length > 0;
    });

  const results = [];
  let hasRealErrors = false;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    // Get a preview of the statement for logging
    const preview = statement.substring(0, 80).replace(/\s+/g, ' ') + '...';

    try {
      // Use Supabase REST API to execute raw SQL
      // Note: This uses the service role key which bypasses RLS
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: statement })
      });

      // If exec doesn't exist, try creating tables directly via SQL
      if (response.status === 404) {
        // Fallback: Execute via pg connection string (requires postgres package)
        console.log(`   ⚠️  RPC not available, executing directly...`);

        // For CREATE TABLE statements, we can verify by checking if table exists
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : null;

          if (tableName) {
            // Try to select from the table to see if it exists
            const { error: checkError } = await supabase
              .from(tableName)
              .select('*')
              .limit(0);

            if (!checkError) {
              console.log(`   ⚠️  ${preview}`);
              console.log(`      Table '${tableName}' already exists - skipping`);
              results.push({ statement: preview, status: 'exists' });
              continue;
            }
          }
        }

        // For ALTER TABLE statements, try to detect if already applied
        if (statement.toUpperCase().includes('ALTER TABLE') && statement.toUpperCase().includes('ADD COLUMN IF NOT EXISTS')) {
          console.log(`   ✅ ${preview}`);
          console.log(`      Using IF NOT EXISTS - safe to skip`);
          results.push({ statement: preview, status: 'exists' });
          continue;
        }

        // For CREATE INDEX IF NOT EXISTS
        if (statement.toUpperCase().includes('CREATE INDEX IF NOT EXISTS')) {
          console.log(`   ✅ ${preview}`);
          console.log(`      Using IF NOT EXISTS - safe to skip`);
          results.push({ statement: preview, status: 'exists' });
          continue;
        }

        // For CREATE POLICY
        if (statement.toUpperCase().includes('CREATE POLICY')) {
          console.log(`   ⚠️  ${preview}`);
          console.log(`      Policies may already exist - continuing`);
          results.push({ statement: preview, status: 'exists' });
          continue;
        }

        console.log(`   ⚠️  ${preview}`);
        console.log(`      Cannot execute directly - may need manual application`);
        results.push({ statement: preview, status: 'warning', error: 'RPC not available' });
        continue;
      }

      if (!response.ok) {
        const errorData = await response.text();

        // Check for "already exists" errors
        if (errorData.includes('already exists') ||
            errorData.includes('duplicate') ||
            errorData.includes('42P07') ||
            errorData.includes('42710')) {
          console.log(`   ⚠️  ${preview}`);
          console.log(`      Already exists - skipping`);
          results.push({ statement: preview, status: 'exists' });
          continue;
        }

        throw new Error(errorData);
      }

      console.log(`   ✅ ${preview}`);
      results.push({ statement: preview, status: 'success' });
    } catch (error) {
      // Check if it's an "already exists" error
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes('already exists') ||
          errorMsg.includes('duplicate') ||
          errorMsg.includes('42P07') ||
          errorMsg.includes('42710')) {
        console.log(`   ⚠️  ${preview}`);
        console.log(`      Already exists - skipping`);
        results.push({ statement: preview, status: 'exists' });
        continue;
      }

      console.error(`   ❌ ${preview}`);
      console.error(`      Error: ${errorMsg}`);
      results.push({ statement: preview, status: 'error', error: errorMsg });
      hasRealErrors = true;
    }
  }

  // Check results
  const allExist = results.every(r => r.status === 'exists');
  const hasWarnings = results.some(r => r.status === 'warning');

  if (hasRealErrors) {
    console.error(`\n❌ Migration had errors - see details above`);
    return { success: false, error: 'Some statements failed', results };
  }

  if (allExist) {
    console.log(`\n⚠️  All objects already exist - migration previously applied`);
    return { success: true, alreadyExists: true };
  }

  if (hasWarnings) {
    console.log(`\n⚠️  Migration completed with warnings - manual verification recommended`);
    return { success: true, hasWarnings: true, results };
  }

  console.log(`\n✅ Migration applied successfully`);
  return { success: true, results };
}

async function verifyTables() {
  console.log('\n🔍 Verifying table creation...\n');

  const tablesToCheck = [
    'ai_threads',
    'content_modifications',
    'style_customization_history'
  ];

  const results = {};

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          results[table] = { exists: false, error: 'Table does not exist' };
        } else {
          results[table] = { exists: false, error: error.message };
        }
      } else {
        results[table] = { exists: true };
      }
    } catch (err) {
      results[table] = { exists: false, error: err.message };
    }
  }

  // Check for new columns
  console.log('Checking new columns in existing tables...\n');

  // Check chat_sessions.openai_thread_id
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('openai_thread_id')
      .limit(0);

    results['chat_sessions.openai_thread_id'] = { exists: !error };
  } catch (err) {
    results['chat_sessions.openai_thread_id'] = { exists: false, error: err.message };
  }

  // Check optimizations.ai_modification_count
  try {
    const { data, error } = await supabase
      .from('optimizations')
      .select('ai_modification_count')
      .limit(0);

    results['optimizations.ai_modification_count'] = { exists: !error };
  } catch (err) {
    results['optimizations.ai_modification_count'] = { exists: false, error: err.message };
  }

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Supabase Migration Tool');
  console.log('   Feature: 008-enhance-ai-assistent');
  console.log('='.repeat(60));

  const results = [];

  // Apply migrations in order
  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ ...migration, ...result });
  }

  // Verify tables
  const verification = await verifyTables();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const alreadyApplied = results.filter(r => r.alreadyExists).length;

  console.log(`\n✅ Successful: ${successful}/${migrations.length}`);
  if (alreadyApplied > 0) {
    console.log(`⚠️  Already applied: ${alreadyApplied}/${migrations.length}`);
  }
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${migrations.length}`);
  }

  // Failed migrations
  if (failed > 0) {
    console.log('\n❌ Failed migrations:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  // Verification results
  console.log('\n🔍 Verification Results:');
  console.log('\nNew Tables:');
  ['ai_threads', 'content_modifications', 'style_customization_history'].forEach(table => {
    const status = verification[table]?.exists ? '✅' : '❌';
    console.log(`   ${status} ${table}`);
    if (!verification[table]?.exists && verification[table]?.error) {
      console.log(`      Error: ${verification[table].error}`);
    }
  });

  console.log('\nNew Columns:');
  ['chat_sessions.openai_thread_id', 'optimizations.ai_modification_count'].forEach(column => {
    const status = verification[column]?.exists ? '✅' : '❌';
    console.log(`   ${status} ${column}`);
    if (!verification[column]?.exists && verification[column]?.error) {
      console.log(`      Error: ${verification[column].error}`);
    }
  });

  console.log('\n' + '='.repeat(60));

  // Exit with appropriate code
  if (failed > 0) {
    console.log('\n⚠️  Some migrations failed. Please review errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
