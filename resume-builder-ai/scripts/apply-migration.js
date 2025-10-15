/**
 * Script to apply the applications table migration to Supabase
 * Run with: node scripts/apply-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key (has admin permissions)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📋 Reading migration file...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251014000000_add_applications_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration to Supabase...');

    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try alternative method using REST API directly
      console.log('⚠️  RPC method failed, trying direct execution...');

      // Split migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('CREATE TABLE') ||
            statement.includes('CREATE INDEX') ||
            statement.includes('ALTER TABLE') ||
            statement.includes('CREATE POLICY') ||
            statement.includes('CREATE TRIGGER') ||
            statement.includes('CREATE OR REPLACE FUNCTION') ||
            statement.includes('DO $$')) {

          console.log(`  Executing: ${statement.substring(0, 50)}...`);

          // Note: Supabase client doesn't support direct SQL execution
          // User needs to run this in Supabase SQL Editor
          console.log('⚠️  This statement needs to be run in Supabase SQL Editor');
        }
      }

      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('Please open Supabase SQL Editor and run the migration manually:');
      console.log(`📁 File: ${migrationPath}`);
      console.log(`🔗 Supabase URL: ${supabaseUrl.replace('/rest/v1', '')}`);
      console.log('\nSteps:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy the contents of the migration file');
      console.log('4. Paste and run the SQL');

      return;
    }

    console.log('✅ Migration applied successfully!');

    // Verify the table was created
    console.log('🔍 Verifying applications table...');
    const { data: tables, error: verifyError } = await supabase
      .from('applications')
      .select('id')
      .limit(0);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      console.log('✅ Applications table exists and is accessible!');
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
