#!/usr/bin/env node
/**
 * Apply Column Name Fixes
 *
 * Renames database columns to match TypeScript interfaces:
 * - design_customizations: spacing_settings → spacing
 * - job_descriptions: extracted_data → parsed_data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Check your .env.local file');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkColumn(table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  return !error;
}

async function applyFixes() {
  console.log('\n🔧 Applying Database Column Fixes\n');
  console.log('=' .repeat(50));

  try {
    // Check current state
    console.log('\n📊 Checking current column names...\n');

    const hasSpacingSettings = await checkColumn('design_customizations', 'spacing_settings');
    const hasSpacing = await checkColumn('design_customizations', 'spacing');
    const hasExtractedData = await checkColumn('job_descriptions', 'extracted_data');
    const hasParsedData = await checkColumn('job_descriptions', 'parsed_data');

    console.log('design_customizations:');
    console.log(`  - spacing_settings: ${hasSpacingSettings ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  - spacing: ${hasSpacing ? '✅ EXISTS' : '❌ NOT FOUND'}`);

    console.log('\njob_descriptions:');
    console.log(`  - extracted_data: ${hasExtractedData ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  - parsed_data: ${hasParsedData ? '✅ EXISTS' : '❌ NOT FOUND'}`);

    // Determine what needs to be done
    const needsSpacingFix = hasSpacingSettings && !hasSpacing;
    const needsParsedDataFix = hasExtractedData && !hasParsedData;

    if (!needsSpacingFix && !needsParsedDataFix) {
      console.log('\n✅ All columns are already correct!');
      return;
    }

    console.log('\n🚀 Applying fixes...\n');

    // Note: We can't execute ALTER TABLE directly through Supabase JS client
    // The user will need to run these commands manually in Supabase Studio SQL Editor

    console.log('⚠️  Manual Action Required:');
    console.log('   Please run the following SQL commands in Supabase Studio:');
    console.log('   (https://app.supabase.com → SQL Editor)\n');

    if (needsSpacingFix) {
      console.log('-- Fix design_customizations column');
      console.log('ALTER TABLE design_customizations');
      console.log('  RENAME COLUMN spacing_settings TO spacing;\n');
    }

    if (needsParsedDataFix) {
      console.log('-- Fix job_descriptions column');
      console.log('ALTER TABLE job_descriptions');
      console.log('  RENAME COLUMN extracted_data TO parsed_data;\n');
    }

    console.log('=' .repeat(50));
    console.log('\n💡 After running the SQL commands, run this script again to verify.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

applyFixes();
