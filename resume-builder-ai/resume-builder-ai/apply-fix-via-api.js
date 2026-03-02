/**
 * Apply SQL Fix via Supabase Management API
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = supabaseUrl.split('//')[1].split('.')[0];

// Read SQL from file
const sqlFile = path.join(__dirname, 'supabase', 'migrations', '20251109000000_fix_column_names_direct.sql');
const fullSQL = fs.readFileSync(sqlFile, 'utf8');

console.log('='.repeat(80));
console.log('MANUAL FIX INSTRUCTIONS');
console.log('='.repeat(80));
console.log('');
console.log(`Project Reference: ${projectRef}`);
console.log(`Supabase URL: ${supabaseUrl}`);
console.log('');
console.log('Since automated execution is restricted, please apply the fix manually:');
console.log('');
console.log('STEP 1: Go to Supabase SQL Editor');
console.log(`   URL: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log('');
console.log('STEP 2: Copy and paste the following SQL:');
console.log('='.repeat(80));
console.log(fullSQL);
console.log('='.repeat(80));
console.log('');
console.log('STEP 3: Click "Run" to execute the migration');
console.log('');
console.log('STEP 4: Verify the output shows:');
console.log('   - NOTICE: Renamed job_descriptions.extracted_data to parsed_data');
console.log('   - NOTICE: Renamed design_customizations.spacing_settings to spacing');
console.log('   - NOTICE: VERIFIED: job_descriptions.parsed_data exists');
console.log('   - NOTICE: VERIFIED: design_customizations.spacing exists');
console.log('');
console.log('='.repeat(80));
console.log('');

// Alternative: Try using simple ALTER statements via Supabase client
console.log('Alternatively, try executing these two simple SQL statements:');
console.log('');
console.log('1. ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;');
console.log('2. ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;');
console.log('');
console.log('='.repeat(80));

// Save the SQL to a quick-access file
const quickFixPath = path.join(__dirname, 'QUICK_FIX.sql');
fs.writeFileSync(quickFixPath, fullSQL);
console.log(`SQL saved to: ${quickFixPath}`);
console.log('');
