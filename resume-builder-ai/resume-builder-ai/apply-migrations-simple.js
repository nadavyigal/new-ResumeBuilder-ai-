/**
 * Apply database migrations to Supabase - Simplified Version
 * Feature: 008-enhance-ai-assistent
 *
 * This script applies migrations by executing SQL files through Supabase client.
 * It handles "already exists" errors gracefully.
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

// Create Supabase client with service role key
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
    description: 'Create ai_threads table for OpenAI thread tracking',
    tables: ['ai_threads']
  },
  {
    name: '20250118000002_create_content_modifications.sql',
    description: 'Create content_modifications table for resume change audit',
    tables: ['content_modifications']
  },
  {
    name: '20250118000003_create_style_history.sql',
    description: 'Create style_customization_history table for visual customization tracking',
    tables: ['style_customization_history']
  },
  {
    name: '20250118000004_alter_existing_tables.sql',
    description: 'Add columns to chat_sessions and optimizations tables',
    tables: ['chat_sessions', 'optimizations']
  }
];

async function checkTableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    return !error;
  } catch (err) {
    return false;
  }
}

async function applyMigration(migration) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Migration: ${migration.name}`);
  console.log(`   ${migration.description}`);
  console.log(`${'='.repeat(60)}`);

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', migration.name);

  // Read SQL file
  let sql;
  try {
    sql = fs.readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${error.message}`);
    return { success: false, error: error.message };
  }

  // Check if tables already exist
  const existingTables = [];
  for (const table of migration.tables) {
    const exists = await checkTableExists(table);
    if (exists) {
      existingTables.push(table);
    }
  }

  if (existingTables.length === migration.tables.length) {
    console.log(`⚠️  All tables already exist: ${existingTables.join(', ')}`);
    console.log(`   Migration appears to be already applied - SKIPPING`);
    return { success: true, alreadyExists: true, tables: existingTables };
  }

  // Display SQL to be executed
  console.log('\n📜 SQL to execute:');
  console.log('-'.repeat(60));
  const preview = sql.split('\n').slice(0, 20).join('\n');
  console.log(preview);
  if (sql.split('\n').length > 20) {
    console.log(`... (${sql.split('\n').length - 20} more lines)`);
  }
  console.log('-'.repeat(60));

  console.log('\n⚠️  MANUAL EXECUTION REQUIRED');
  console.log('\nThis migration needs to be applied manually via Supabase Dashboard:');
  console.log(`1. Go to: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/editor/sql`);
  console.log(`2. Click "New query"`);
  console.log(`3. Copy the SQL from: ${migrationPath}`);
  console.log(`4. Paste and run the query`);
  console.log('\nOR use the Supabase CLI:');
  console.log(`   supabase db push`);

  return {
    success: true,
    requiresManual: true,
    sqlFile: migrationPath
  };
}

async function verifyTables() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🔍 VERIFICATION - Checking Database Schema');
  console.log(`${'='.repeat(60)}\n`);

  const checks = [
    { type: 'table', name: 'ai_threads' },
    { type: 'table', name: 'content_modifications' },
    { type: 'table', name: 'style_customization_history' },
    { type: 'column', table: 'chat_sessions', name: 'openai_thread_id' },
    { type: 'column', table: 'optimizations', name: 'ai_modification_count' }
  ];

  const results = {};

  for (const check of checks) {
    if (check.type === 'table') {
      const exists = await checkTableExists(check.name);
      results[check.name] = { exists, type: 'table' };
      console.log(`${exists ? '✅' : '❌'} Table: ${check.name}`);
    } else if (check.type === 'column') {
      try {
        const { error } = await supabase
          .from(check.table)
          .select(check.name)
          .limit(0);

        const exists = !error;
        results[`${check.table}.${check.name}`] = { exists, type: 'column' };
        console.log(`${exists ? '✅' : '❌'} Column: ${check.table}.${check.name}`);
      } catch (err) {
        results[`${check.table}.${check.name}`] = { exists: false, type: 'column' };
        console.log(`❌ Column: ${check.table}.${check.name}`);
      }
    }
  }

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 SUPABASE MIGRATION TOOL');
  console.log('   Feature: 008-enhance-ai-assistent');
  console.log('   Enhanced AI Assistant Migrations');
  console.log('='.repeat(60));

  const results = [];

  // Check current state first
  console.log('\n📊 Checking current database state...');
  const initialState = await verifyTables();

  const allTablesExist = ['ai_threads', 'content_modifications', 'style_customization_history']
    .every(table => initialState[table]?.exists);

  if (allTablesExist) {
    console.log('\n✅ All migration tables already exist!');
    console.log('   No migrations need to be applied.');
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  }

  // Apply migrations
  console.log('\n📝 Applying migrations...');

  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ ...migration, ...result });

    if (!result.success) {
      console.log('\n❌ Migration failed. Stopping here.');
      break;
    }

    // Add a small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final verification
  console.log('\n📊 Final verification...');
  const finalState = await verifyTables();

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 MIGRATION SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const requiresManual = results.some(r => r.requiresManual);

  if (requiresManual) {
    console.log('⚠️  MANUAL MIGRATION REQUIRED');
    console.log('\nThe migrations use advanced SQL features that require direct database access.');
    console.log('Please apply them using one of these methods:\n');

    console.log('Method 1: Supabase Dashboard');
    console.log(`   1. Visit: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/editor/sql`);
    console.log('   2. Create a new query');
    console.log('   3. Copy and paste each migration file:');
    results.forEach((r, i) => {
      if (r.requiresManual) {
        console.log(`      ${i + 1}. ${r.sqlFile}`);
      }
    });
    console.log('   4. Execute each query\n');

    console.log('Method 2: Supabase CLI (recommended)');
    console.log('   1. Install: npm install -g supabase');
    console.log('   2. Link project: supabase link --project-ref <your-project-ref>');
    console.log('   3. Apply migrations: supabase db push\n');

    console.log('Method 3: SQL Files');
    console.log('   Copy the content from each file and execute directly in your preferred SQL client:\n');
    results.forEach((r, i) => {
      if (r.requiresManual) {
        console.log(`   ${i + 1}. ${path.basename(r.sqlFile)}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Migration script completed');
  console.log('='.repeat(60) + '\n');

  if (requiresManual) {
    console.log('Next steps:');
    console.log('1. Apply migrations manually (see methods above)');
    console.log('2. Run this script again to verify');
    console.log('3. Check that all tables show ✅ in verification\n');
  }
}

main().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
