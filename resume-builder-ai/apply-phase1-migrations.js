/**
 * Script to apply Phase 1 migrations for Enhanced AI Assistant feature
 *
 * This script applies the 4 migration files created for Phase 1:
 * - 20250118000001_create_ai_threads.sql
 * - 20250118000002_create_content_modifications.sql
 * - 20250118000003_create_style_history.sql
 * - 20250118000004_alter_existing_tables.sql
 *
 * Run with: node apply-phase1-migrations.js
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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrations = [
  '20250118000001_create_ai_threads.sql',
  '20250118000002_create_content_modifications.sql',
  '20250118000003_create_style_history.sql',
  '20250118000004_alter_existing_tables.sql',
];

async function applyMigration(filename) {
  console.log(`\n📄 Applying migration: ${filename}`);

  const filepath = path.join(__dirname, 'supabase', 'migrations', filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Migration file not found: ${filepath}`);
    return false;
  }

  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Check if table already exists (not a critical error)
      if (error.message && error.message.includes('already exists')) {
        console.log(`⚠️  Table already exists (skipping): ${filename}`);
        return true;
      }
      throw error;
    }

    console.log(`✅ Successfully applied: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Error applying ${filename}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Phase 1 migration application...\n');
  console.log('Database:', supabaseUrl);

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}/${migrations.length}`);
  console.log(`   ❌ Failed: ${failCount}/${migrations.length}`);
  console.log('='.repeat(50));

  if (failCount === 0) {
    console.log('\n🎉 All Phase 1 migrations applied successfully!');
    console.log('\nNext steps:');
    console.log('  1. Verify tables exist in Supabase dashboard');
    console.log('  2. Check RLS policies are enabled');
    console.log('  3. Proceed to Phase 2: Fix Thread ID Error');
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    console.log('You may need to apply them manually via Supabase SQL editor.');
  }
}

main().catch(console.error);
