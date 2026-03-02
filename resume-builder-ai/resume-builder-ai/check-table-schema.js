#!/usr/bin/env node
/**
 * Check actual table schemas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableSchemas() {
  console.log('Checking Table Schemas...\n');

  // Tables to check
  const tables = [
    'profiles',
    'job_descriptions',
    'design_customizations',
    'resumes',
    'optimizations'
  ];

  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log('❌ Error:', error.message);
        console.log('   Code:', error.code);
      } else {
        if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log('✅ Columns:', columns.join(', '));
        } else {
          console.log('⚠️  Table exists but is empty');
          console.log('   Cannot determine column names from empty table');
        }
      }
    } catch (err) {
      console.log('❌ Exception:', err.message);
    }
  }

  console.log('\n\n=== CHECKING RLS STATUS ===');

  // Check RLS with anon key
  const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  for (const table of tables) {
    try {
      const { data, error } = await anonSupabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST301' || error.message.includes('row-level security')) {
          console.log(`✅ ${table}: RLS enabled (properly secured)`);
        } else {
          console.log(`⚠️  ${table}: Error -`, error.message);
        }
      } else {
        console.log(`⚠️  ${table}: RLS may be disabled (public access works)`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Exception -`, err.message);
    }
  }
}

checkTableSchemas();
