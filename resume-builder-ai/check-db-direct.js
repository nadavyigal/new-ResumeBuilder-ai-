/**
 * Direct Database Schema Check using Raw SQL
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw error;
  return data;
}

async function checkSchema() {
  console.log('='.repeat(80));
  console.log('DATABASE SCHEMA VERIFICATION - Direct SQL Approach');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: Check if job_descriptions has parsed_data or extracted_data
    console.log('1. Checking job_descriptions table columns...');
    try {
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (jdError) {
        console.log(`   ✗ Error accessing job_descriptions: ${jdError.message}`);
      } else {
        console.log('   ✓ job_descriptions table exists and is accessible');

        // Try to select parsed_data
        const { error: parsedError } = await supabase
          .from('job_descriptions')
          .select('parsed_data')
          .limit(1)
          .maybeSingle();

        if (parsedError) {
          console.log(`   ✗ parsed_data column error: ${parsedError.message}`);

          // Try extracted_data
          const { error: extractedError } = await supabase
            .from('job_descriptions')
            .select('extracted_data')
            .limit(1)
            .maybeSingle();

          if (extractedError) {
            console.log(`   ✗ extracted_data column error: ${extractedError.message}`);
            console.log('   ⚠️  CRITICAL: Neither parsed_data nor extracted_data exists!');
          } else {
            console.log('   ⚠️  ISSUE: Column is "extracted_data" but should be "parsed_data"');
            console.log('   → Need to run migration: ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data');
          }
        } else {
          console.log('   ✓ parsed_data column exists');
        }
      }
    } catch (e) {
      console.log(`   ✗ Unexpected error: ${e.message}`);
    }
    console.log('');

    // Test 2: Check design_customizations
    console.log('2. Checking design_customizations table columns...');
    try {
      const { data: dcData, error: dcError } = await supabase
        .from('design_customizations')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (dcError) {
        console.log(`   ✗ Error accessing design_customizations: ${dcError.message}`);
      } else {
        console.log('   ✓ design_customizations table exists and is accessible');

        // Try spacing
        const { error: spacingError } = await supabase
          .from('design_customizations')
          .select('spacing')
          .limit(1)
          .maybeSingle();

        if (spacingError) {
          console.log(`   ✗ spacing column error: ${spacingError.message}`);

          // Try spacing_settings
          const { error: settingsError } = await supabase
            .from('design_customizations')
            .select('spacing_settings')
            .limit(1)
            .maybeSingle();

          if (settingsError) {
            console.log(`   ✗ spacing_settings column error: ${settingsError.message}`);
            console.log('   ⚠️  CRITICAL: Neither spacing nor spacing_settings exists!');
          } else {
            console.log('   ⚠️  ISSUE: Column is "spacing_settings" but should be "spacing"');
            console.log('   → Need to run migration: ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing');
          }
        } else {
          console.log('   ✓ spacing column exists');
        }
      }
    } catch (e) {
      console.log(`   ✗ Unexpected error: ${e.message}`);
    }
    console.log('');

    // Test 3: Check optimizations table
    console.log('3. Checking optimizations table key columns...');
    try {
      const { data, error } = await supabase
        .from('optimizations')
        .select('id, user_id, jd_id, rewrite_data, ats_score_optimized, ats_suggestions')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log(`   ✗ Error: ${error.message}`);
      } else {
        console.log('   ✓ All key columns accessible (id, user_id, jd_id, rewrite_data, ats_score_optimized, ats_suggestions)');
      }
    } catch (e) {
      console.log(`   ✗ Unexpected error: ${e.message}`);
    }
    console.log('');

    // Test 4: Check chat tables
    console.log('4. Checking chat tables...');
    const chatTables = ['chat_sessions', 'chat_messages', 'resume_versions', 'amendment_requests'];
    for (const table of chatTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1)
          .maybeSingle();

        if (error) {
          console.log(`   ✗ ${table}: ${error.message}`);
        } else {
          console.log(`   ✓ ${table} exists`);
        }
      } catch (e) {
        console.log(`   ✗ ${table}: ${e.message}`);
      }
    }
    console.log('');

    // Test 5: Check design tables
    console.log('5. Checking design tables...');
    const designTables = ['design_templates', 'design_customizations', 'resume_design_assignments'];
    for (const table of designTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1)
          .maybeSingle();

        if (error) {
          console.log(`   ✗ ${table}: ${error.message}`);
        } else {
          console.log(`   ✓ ${table} exists`);
        }
      } catch (e) {
        console.log(`   ✗ ${table}: ${e.message}`);
      }
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('Based on the checks above, you need to:');
    console.log('1. Apply pending migrations to fix column names');
    console.log('2. Specifically run migration 20251104_fix_column_names.sql');
    console.log('3. Use: npx supabase db push');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

checkSchema();
