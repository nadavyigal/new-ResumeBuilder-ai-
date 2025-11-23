/**
 * Apply database migrations to Supabase using direct PostgreSQL connection
 * Feature: 008-enhance-ai-assistent
 *
 * This script requires the 'pg' package to execute SQL directly.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project reference from Supabase URL');
  process.exit(1);
}

// Construct database connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// Note: The password is typically the service role key or a separate database password
console.log('⚠️  WARNING: Direct PostgreSQL connection requires database password');
console.log('   This script needs to be configured with your database password.');
console.log('   You can find it in Supabase Dashboard > Settings > Database');
console.log(`\nProject Reference: ${projectRef}`);
console.log(`Database Host: db.${projectRef}.supabase.co`);
console.log('\nTo use this script:');
console.log('1. Add SUPABASE_DB_PASSWORD to your .env.local file');
console.log('2. Install pg: npm install pg');
console.log('3. Run this script again');
console.log('\nAlternatively, use the Supabase CLI (recommended):');
console.log('  npx supabase db push');
process.exit(0);

// This code below would work if pg is installed and DB password is provided
/*
const { Client } = require('pg');

const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`;

const migrations = [
  '20250118000001_create_ai_threads.sql',
  '20250118000002_create_content_modifications.sql',
  '20250118000003_create_style_history.sql',
  '20250118000004_alter_existing_tables.sql'
];

async function applyMigrations() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, 'supabase', 'migrations', migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      console.log(`\n📄 Applying: ${migrationFile}`);

      try {
        await client.query(sql);
        console.log(`✅ Success`);
      } catch (error) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
          console.log(`⚠️  Already exists - skipping`);
        } else {
          console.error(`❌ Error: ${error.message}`);
          throw error;
        }
      }
    }
  } finally {
    await client.end();
  }
}

applyMigrations().catch(console.error);
*/
