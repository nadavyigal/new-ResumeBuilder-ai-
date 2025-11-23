// Temporary script to apply database migration
// Run: node apply-migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('🔄 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251104_fix_column_names.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration file loaded');
console.log('SQL to execute:');
console.log('---');
console.log(migrationSQL);
console.log('---');

async function applyMigration() {
  try {
    console.log('🚀 Applying migration...');

    // Execute the ALTER TABLE statements
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('Result:', data);

    // Verify the columns exist
    console.log('\n🔍 Verifying column changes...');

    // Check design_customizations.spacing
    const { data: spacingCheck, error: spacingError } = await supabase
      .from('design_customizations')
      .select('spacing')
      .limit(1);

    if (!spacingError) {
      console.log('✅ design_customizations.spacing column exists');
    } else {
      console.error('❌ design_customizations.spacing check failed:', spacingError);
    }

    // Check job_descriptions.parsed_data
    const { data: parsedDataCheck, error: parsedDataError } = await supabase
      .from('job_descriptions')
      .select('parsed_data')
      .limit(1);

    if (!parsedDataError) {
      console.log('✅ job_descriptions.parsed_data column exists');
    } else {
      console.error('❌ job_descriptions.parsed_data check failed:', parsedDataError);
    }

    console.log('\n🎉 Migration complete!');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();
