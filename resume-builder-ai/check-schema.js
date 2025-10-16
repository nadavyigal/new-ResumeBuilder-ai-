// Quick script to check your actual database schema
// Run with: node check-schema.js

const { createClient } = require('@supabase/supabase-js');

// Get these from your .env.local file
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
  console.log('Checking database schema...\n');
  
  try {
    // Test 1: Try to query resumes.raw_text
    console.log('1. Testing resumes.raw_text:');
    const { data: resumes, error: resumeError } = await supabase
      .from('resumes')
      .select('raw_text')
      .limit(1);
    
    if (resumeError) {
      console.log(`   ❌ Error: ${resumeError.message}`);
      console.log(`   Hint: Column 'raw_text' probably doesn't exist in resumes table`);
    } else {
      console.log(`   ✅ resumes.raw_text exists!`);
    }

    // Test 2: Try to query job_descriptions.raw_text
    console.log('\n2. Testing job_descriptions.raw_text:');
    const { data: jds, error: jdError } = await supabase
      .from('job_descriptions')
      .select('raw_text')
      .limit(1);
    
    if (jdError) {
      console.log(`   ❌ Error: ${jdError.message}`);
      console.log(`   Hint: Column 'raw_text' probably doesn't exist in job_descriptions table`);
    } else {
      console.log(`   ✅ job_descriptions.raw_text exists!`);
    }

    // Test 3: Try the nested query that's failing
    console.log('\n3. Testing nested query (the one that's failing):');
    const { data: opt, error: optError } = await supabase
      .from('optimizations')
      .select('rewrite_data, resumes(raw_text), job_descriptions(raw_text)')
      .limit(1)
      .single();
    
    if (optError) {
      console.log(`   ❌ Error: ${optError.message}`);
      console.log(`   This is THE error you're seeing!`);
    } else {
      console.log(`   ✅ Nested query works!`);
    }

    console.log('\n---\nDiagnosis complete. Share the output above.');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

checkSchema();

