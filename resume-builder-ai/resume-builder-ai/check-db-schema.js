/**
 * Database Schema Verification Script
 * Checks current state of database columns and tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('='.repeat(80));
  console.log('DATABASE SCHEMA VERIFICATION');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Check job_descriptions columns
    console.log('1. Checking job_descriptions table columns...');
    const { data: jdColumns, error: jdError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'job_descriptions')
      .in('column_name', ['parsed_data', 'extracted_data', 'embeddings']);

    if (jdError) {
      console.error('   Error querying job_descriptions:', jdError.message);
    } else {
      console.log('   job_descriptions columns found:');
      jdColumns?.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });

      const hasParsedData = jdColumns?.some(c => c.column_name === 'parsed_data');
      const hasExtractedData = jdColumns?.some(c => c.column_name === 'extracted_data');

      if (!hasParsedData && hasExtractedData) {
        console.log('   ⚠️  ISSUE: Column is named "extracted_data" but should be "parsed_data"');
      } else if (hasParsedData) {
        console.log('   ✓ Column "parsed_data" exists correctly');
      }
    }
    console.log('');

    // Check design_customizations columns
    console.log('2. Checking design_customizations table columns...');
    const { data: dcColumns, error: dcError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'design_customizations')
      .in('column_name', ['spacing', 'spacing_settings', 'color_scheme', 'font_family']);

    if (dcError) {
      console.error('   Error querying design_customizations:', dcError.message);
    } else {
      console.log('   design_customizations columns found:');
      dcColumns?.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });

      const hasSpacing = dcColumns?.some(c => c.column_name === 'spacing');
      const hasSpacingSettings = dcColumns?.some(c => c.column_name === 'spacing_settings');

      if (!hasSpacing && hasSpacingSettings) {
        console.log('   ⚠️  ISSUE: Column is named "spacing_settings" but should be "spacing"');
      } else if (hasSpacing) {
        console.log('   ✓ Column "spacing" exists correctly');
      }
    }
    console.log('');

    // Check all critical tables exist
    console.log('3. Checking critical tables existence...');
    const criticalTables = [
      'profiles',
      'resumes',
      'job_descriptions',
      'optimizations',
      'templates',
      'chat_sessions',
      'chat_messages',
      'resume_versions',
      'amendment_requests',
      'design_templates',
      'design_customizations',
      'resume_design_assignments',
      'applications'
    ];

    for (const tableName of criticalTables) {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .maybeSingle();

      if (error) {
        console.log(`   ✗ ${tableName} - Error: ${error.message}`);
      } else if (data) {
        console.log(`   ✓ ${tableName} exists`);
      } else {
        console.log(`   ✗ ${tableName} MISSING`);
      }
    }
    console.log('');

    // Check optimizations table columns
    console.log('4. Checking optimizations table key columns...');
    const { data: optColumns, error: optError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'optimizations')
      .in('column_name', ['id', 'rewrite_data', 'ats_score_optimized', 'ats_suggestions', 'jd_id', 'user_id']);

    if (optError) {
      console.error('   Error:', optError.message);
    } else {
      optColumns?.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type})`);
      });
    }
    console.log('');

    // Check RLS enabled status
    console.log('5. Checking RLS status on critical tables...');
    const { data: rlsTables, error: rlsError } = await supabase.rpc('check_rls_status', {});

    // Since we can't directly check pg_tables, let's try to access the tables
    const tablesToCheck = ['optimizations', 'chat_sessions', 'chat_messages', 'resume_design_assignments'];

    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
          console.log(`   ⚠️  ${table} - RLS may be blocking access or table doesn't exist`);
        } else {
          console.log(`   ✓ ${table} - accessible`);
        }
      } catch (e) {
        console.log(`   ✗ ${table} - Error: ${e.message}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fatal error during schema check:', error);
  }
}

checkSchema();
