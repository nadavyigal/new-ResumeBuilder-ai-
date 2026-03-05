const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('🔧 Applying database schema fixes...\n');

  // Fix 1: Rename extracted_data to parsed_data
  console.log('Fix 1: Renaming job_descriptions.extracted_data → parsed_data');
  const { data: fix1, error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'job_descriptions' AND column_name = 'extracted_data'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'job_descriptions' AND column_name = 'parsed_data'
        ) THEN
          ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;
          RAISE NOTICE 'Renamed job_descriptions.extracted_data to parsed_data';
        ELSE
          RAISE NOTICE 'job_descriptions.parsed_data already exists or extracted_data missing';
        END IF;
      END $$;
    `
  });

  if (error1) {
    console.log('❌ Fix 1 failed:', error1.message);
    console.log('Trying direct SQL execution...\n');

    const { error: directError1 } = await supabase.from('job_descriptions').select('parsed_data').limit(1);
    if (directError1 && directError1.message.includes('does not exist')) {
      // Column doesn't exist, let's try to rename
      console.log('Attempting ALTER TABLE directly via service role...');
      // This won't work via client, need different approach
      console.log('\n⚠️  Manual fix required. Please run this SQL in Supabase Dashboard:');
      console.log('   ALTER TABLE job_descriptions RENAME COLUMN extracted_data TO parsed_data;\n');
    } else {
      console.log('✅ Fix 1: parsed_data column already exists or is accessible\n');
    }
  } else {
    console.log('✅ Fix 1: Completed successfully\n');
  }

  // Fix 2: Rename spacing_settings to spacing
  console.log('Fix 2: Renaming design_customizations.spacing_settings → spacing');
  const { data: fix2, error: error2 } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'design_customizations' AND column_name = 'spacing_settings'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'design_customizations' AND column_name = 'spacing'
        ) THEN
          ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;
          RAISE NOTICE 'Renamed design_customizations.spacing_settings to spacing';
        ELSE
          RAISE NOTICE 'design_customizations.spacing already exists or spacing_settings missing';
        END IF;
      END $$;
    `
  });

  if (error2) {
    console.log('❌ Fix 2 failed:', error2.message);
    console.log('\n⚠️  Manual fix required. Please run this SQL in Supabase Dashboard:');
    console.log('   ALTER TABLE design_customizations RENAME COLUMN spacing_settings TO spacing;\n');
  } else {
    console.log('✅ Fix 2: Completed successfully\n');
  }

  // Verify the fixes
  console.log('\n🔍 Verifying fixes...');

  const { error: verify1 } = await supabase.from('job_descriptions').select('parsed_data').limit(0);
  if (verify1) {
    console.log('❌ Verification failed for job_descriptions.parsed_data:', verify1.message);
  } else {
    console.log('✅ Verified: job_descriptions.parsed_data exists');
  }

  const { error: verify2 } = await supabase.from('design_customizations').select('spacing').limit(0);
  if (verify2) {
    console.log('❌ Verification failed for design_customizations.spacing:', verify2.message);
  } else {
    console.log('✅ Verified: design_customizations.spacing exists');
  }

  console.log('\n✅ Schema fix attempt complete!\n');
  console.log('If manual fixes are needed, run them in Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/sql/new\n');
}

applyFix().catch(console.error);
