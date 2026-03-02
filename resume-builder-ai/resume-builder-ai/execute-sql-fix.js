/**
 * Execute SQL Fix via Supabase PostgREST
 * This uses a raw SQL execution approach
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'supabase', 'migrations', '20251109000000_fix_column_names_direct.sql');
const sql = fs.readFileSync(sqlFilePath, 'utf8');

console.log('='.repeat(80));
console.log('EXECUTING SQL FIX VIA HTTP API');
console.log('='.repeat(80));
console.log('');
console.log('SQL to execute:');
console.log('-'.repeat(80));
console.log(sql);
console.log('-'.repeat(80));
console.log('');

// Execute via HTTP POST to Supabase PostgREST SQL endpoint
async function executeSQLFix() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Error response:', error);

      // Try alternative approach - direct query execution
      console.log('\nTrying alternative approach - executing statements individually...\n');
      await executeSQLStatementsIndividually();
    } else {
      const result = await response.text();
      console.log('Success!', result);
    }

  } catch (error) {
    console.error('Error executing SQL:', error.message);

    // Try alternative approach
    console.log('\nTrying alternative approach - executing statements individually...\n');
    await executeSQLStatementsIndividually();
  }
}

async function executeSQLStatementsIndividually() {
  const { Client } = require('pg');

  // Extract connection details from Supabase URL
  const dbHost = supabaseUrl.replace('https://', '').replace('http://', '');
  const projectRef = dbHost.split('.')[0];

  console.log('Using PostgreSQL direct connection...');
  console.log('Note: You need to get the database password from Supabase Dashboard');
  console.log(`Project: ${projectRef}`);
  console.log('');
  console.log('Attempting to use service role key as password...');

  // Connection string format for Supabase
  const connectionString = `postgresql://postgres.${projectRef}:${supabaseKey}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Execute Fix 1
    console.log('\n1. Renaming job_descriptions.extracted_data → parsed_data...');
    try {
      await client.query('ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;');
      console.log('   ✓ Successfully renamed');
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log('   ⚠️  Column extracted_data does not exist (may already be renamed)');
      } else {
        console.log(`   ✗ Error: ${e.message}`);
      }
    }

    // Execute Fix 2
    console.log('\n2. Renaming design_customizations.spacing_settings → spacing...');
    try {
      await client.query('ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;');
      console.log('   ✓ Successfully renamed');
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log('   ⚠️  Column spacing_settings does not exist (may already be renamed)');
      } else {
        console.log(`   ✗ Error: ${e.message}`);
      }
    }

    // Verify
    console.log('\n3. Verifying fixes...');
    try {
      const result1 = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
      `);
      if (result1.rows.length > 0) {
        console.log('   ✓ job_descriptions.parsed_data exists');
      } else {
        console.log('   ✗ job_descriptions.parsed_data NOT FOUND');
      }

      const result2 = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'design_customizations' AND column_name = 'spacing'
      `);
      if (result2.rows.length > 0) {
        console.log('   ✓ design_customizations.spacing exists');
      } else {
        console.log('   ✗ design_customizations.spacing NOT FOUND');
      }
    } catch (e) {
      console.log(`   ✗ Verification error: ${e.message}`);
    }

    await client.end();
    console.log('\n✓ Database connection closed');

  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.log('\nPlease apply the fix manually via Supabase SQL Editor:');
    console.log(`${supabaseUrl.replace('/rest/v1', '')}/project/${projectRef}/sql`);
    console.log('\nSQL to execute:');
    console.log(sql);
    process.exit(1);
  }
}

executeSQLStatementsIndividually();
