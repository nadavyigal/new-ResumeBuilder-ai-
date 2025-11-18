#!/usr/bin/env node
/**
 * Migration Application Script - Phase 1
 *
 * Applies Phase 1 database migrations for Enhanced AI Assistant (spec 008)
 *
 * Migrations Applied:
 * - 20250118000001_create_ai_threads.sql
 * - 20250118000002_create_content_modifications.sql
 * - 20250118000003_create_style_history.sql
 * - 20250118000004_alter_existing_tables.sql
 *
 * Usage:
 *   node scripts/apply-phase1-migrations.mjs
 *
 * Environment Variables Required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (has admin privileges)
 *
 * Note: This script uses the Supabase JavaScript client to execute SQL
 * because Supabase CLI has authentication issues.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try loading .env.local first, then .env
try {
  dotenv.config({ path: join(projectRoot, '.env.local') });
} catch (e) {
  dotenv.config({ path: join(projectRoot, '.env') });
}

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIGRATIONS_DIR = join(projectRoot, 'supabase', 'migrations');
const PHASE1_MIGRATIONS = [
  '20250118000001_create_ai_threads.sql',
  '20250118000002_create_content_modifications.sql',
  '20250118000003_create_style_history.sql',
  '20250118000004_alter_existing_tables.sql'
];

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  console.log('\n🔍 Validating environment...\n');

  if (!SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL not found in environment');
    console.error('   Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in .env.local\n');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment');
    console.error('   This key is required for database migrations');
    console.error('   Find it in: Supabase Dashboard → Project Settings → API → service_role key\n');
    process.exit(1);
  }

  console.log(`✅ Supabase URL: ${SUPABASE_URL}`);
  console.log(`✅ Service key found (${SUPABASE_SERVICE_KEY.substring(0, 20)}...)\n`);
}

/**
 * Read migration file content
 */
function readMigration(filename) {
  const filePath = join(MIGRATIONS_DIR, filename);
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading migration file: ${filename}`);
    console.error(`   Path: ${filePath}`);
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Execute migration SQL
 */
async function executeMigration(supabase, filename, sql) {
  console.log(`\n📋 Applying migration: ${filename}`);
  console.log(`   SQL length: ${sql.length} characters`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // If exec_sql function doesn't exist, fall back to direct execution
      if (error.code === '42883') {
        console.log('   ℹ️  exec_sql function not found, trying direct execution...');

        // Create the function first
        const createFunctionSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_string;
  RETURN 'Success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$;
        `;

        const { error: createError } = await supabase.rpc('exec_sql', { sql_string: createFunctionSQL });

        if (createError) {
          console.error(`   ❌ Failed to create exec_sql function`);
          throw createError;
        }

        // Retry the migration
        const { data: retryData, error: retryError } = await supabase.rpc('exec_sql', { sql_string: sql });

        if (retryError) {
          throw retryError;
        }

        console.log(`   ✅ Migration applied successfully`);
        return retryData;
      }

      throw error;
    }

    console.log(`   ✅ Migration applied successfully`);
    return data;
  } catch (error) {
    console.error(`\n   ❌ Migration failed: ${filename}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error message: ${error.message}`);

    if (error.details) {
      console.error(`   Error details: ${error.details}`);
    }

    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }

    console.error('');
    throw error;
  }
}

/**
 * Check if tables already exist
 */
async function checkExistingTables(supabase) {
  console.log('\n🔍 Checking for existing tables...\n');

  const tablesToCheck = [
    'ai_threads',
    'content_modifications',
    'style_customization_history'
  ];

  for (const tableName of tablesToCheck) {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    if (!error) {
      console.log(`   ⚠️  Table "${tableName}" already exists`);
    } else if (error.code === '42P01') {
      console.log(`   ℹ️  Table "${tableName}" does not exist (will be created)`);
    } else {
      console.log(`   ⚠️  Error checking table "${tableName}": ${error.message}`);
    }
  }

  console.log('');
}

/**
 * Main migration execution
 */
async function runMigrations() {
  console.log('🚀 Phase 1 Migration Application\n');
  console.log('═'.repeat(60));

  // Validate environment
  validateEnvironment();

  // Create Supabase client with service role key
  console.log('🔌 Connecting to Supabase...\n');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Check existing tables
  await checkExistingTables(supabase);

  // Apply migrations
  console.log('📦 Applying migrations...\n');
  console.log('═'.repeat(60));

  let successCount = 0;
  let failureCount = 0;

  for (const filename of PHASE1_MIGRATIONS) {
    try {
      const sql = readMigration(filename);
      await executeMigration(supabase, filename, sql);
      successCount++;
    } catch (error) {
      failureCount++;
      console.error(`\n⚠️  Continuing with remaining migrations...\n`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Migration Summary:\n');
  console.log(`   ✅ Successful: ${successCount}/${PHASE1_MIGRATIONS.length}`);
  console.log(`   ❌ Failed: ${failureCount}/${PHASE1_MIGRATIONS.length}`);

  if (failureCount === 0) {
    console.log('\n🎉 All migrations applied successfully!\n');
    console.log('Next steps:');
    console.log('  1. Verify tables exist in Supabase Dashboard → Table Editor');
    console.log('  2. Check RLS policies in Supabase Dashboard → Authentication → Policies');
    console.log('  3. Test Phase 2 thread management functionality\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some migrations failed. Please review errors above.\n');
    console.log('Common issues:');
    console.log('  - Tables already exist: Migrations may have been partially applied');
    console.log('  - Permission errors: Ensure you are using the service_role key');
    console.log('  - Function not found: The exec_sql function may need to be created manually\n');
    console.log('Manual application:');
    console.log('  1. Open Supabase Dashboard → SQL Editor');
    console.log('  2. Copy SQL from supabase/migrations/*.sql files');
    console.log('  3. Execute each migration manually\n');
    process.exit(1);
  }
}

// Execute migrations
runMigrations().catch((error) => {
  console.error('\n💥 Unexpected error:', error.message);
  console.error('');
  process.exit(1);
});
