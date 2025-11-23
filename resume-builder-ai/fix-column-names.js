/**
 * Fix Database Column Names
 * Executes SQL to rename mismatched columns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  }
});

async function fixColumnNames() {
  console.log('='.repeat(80));
  console.log('FIXING DATABASE COLUMN NAMES');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Fix 1: Rename extracted_data to parsed_data in job_descriptions
    console.log('1. Renaming job_descriptions.extracted_data → parsed_data...');
    const { error: fix1Error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;'
    });

    if (fix1Error) {
      if (fix1Error.message.includes('does not exist')) {
        console.log('   ⚠️  Column already named parsed_data or extracted_data does not exist');
      } else {
        console.log(`   ✗ Error: ${fix1Error.message}`);
        throw fix1Error;
      }
    } else {
      console.log('   ✓ Successfully renamed extracted_data to parsed_data');
    }
    console.log('');

    // Fix 2: Rename spacing_settings to spacing in design_customizations
    console.log('2. Renaming design_customizations.spacing_settings → spacing...');
    const { error: fix2Error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;'
    });

    if (fix2Error) {
      if (fix2Error.message.includes('does not exist')) {
        console.log('   ⚠️  Column already named spacing or spacing_settings does not exist');
      } else {
        console.log(`   ✗ Error: ${fix2Error.message}`);
        throw fix2Error;
      }
    } else {
      console.log('   ✓ Successfully renamed spacing_settings to spacing');
    }
    console.log('');

    // Verify the fixes
    console.log('3. Verifying fixes...');

    // Verify parsed_data
    const { error: verify1 } = await supabase
      .from('job_descriptions')
      .select('parsed_data')
      .limit(1)
      .maybeSingle();

    if (verify1) {
      console.log(`   ✗ job_descriptions.parsed_data: ${verify1.message}`);
    } else {
      console.log('   ✓ job_descriptions.parsed_data exists');
    }

    // Verify spacing
    const { error: verify2 } = await supabase
      .from('design_customizations')
      .select('spacing')
      .limit(1)
      .maybeSingle();

    if (verify2) {
      console.log(`   ✗ design_customizations.spacing: ${verify2.message}`);
    } else {
      console.log('   ✓ design_customizations.spacing exists');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('COLUMN RENAME COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Fatal error during column rename:', error.message);
    process.exit(1);
  }
}

fixColumnNames();
