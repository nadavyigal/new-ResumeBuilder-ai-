#!/usr/bin/env node
/**
 * Apply RLS fix to enable Row Level Security on all tables
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRLSFix() {
  console.log('🔒 Enabling Row Level Security (RLS)...\n');

  const tables = [
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'templates',
    'design_templates',
    'design_customizations',
    'resume_design_assignments',
    'chat_sessions',
    'chat_messages',
    'resume_versions',
    'amendment_requests',
    'applications'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const table of tables) {
    try {
      // Enable RLS using raw SQL via REST API won't work directly
      // We need to use a migration or SQL editor
      console.log(`⚠️  ${table}: Cannot enable RLS via JavaScript SDK`);
      failCount++;
    } catch (err) {
      console.log(`❌ ${table}: Error - ${err.message}`);
      failCount++;
    }
  }

  console.log('\n=== MANUAL ACTION REQUIRED ===');
  console.log('RLS cannot be enabled via the JavaScript SDK.');
  console.log('Please run ENABLE_RLS.sql in the Supabase Dashboard:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/brtdyamysfmctrhuankn/sql/new');
  console.log('2. Copy and paste the contents of ENABLE_RLS.sql');
  console.log('3. Execute the SQL');
  console.log('');
  console.log('Alternatively, use the Supabase CLI:');
  console.log('   supabase db execute --file ENABLE_RLS.sql --db-url "your-connection-string"');
  console.log('==============================\n');

  return { successCount, failCount };
}

applyRLSFix().then(({ successCount, failCount }) => {
  if (failCount > 0) {
    console.log(`Summary: ${failCount} tables require manual RLS enablement`);
  }
});
