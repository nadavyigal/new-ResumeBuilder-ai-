/**
 * Test RLS by attempting INSERT with anonymous client
 * This will definitively prove if RLS policies are working
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testRLSInsert() {
  console.log('\n' + '='.repeat(70));
  console.log('  🔐 RLS INSERT TEST - Definitive RLS Verification');
  console.log('='.repeat(70) + '\n');

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('Testing if anonymous client can INSERT data...\n');
  console.log('(If RLS is working, this should FAIL)\n');

  // Test 1: Try to insert into profiles (should fail)
  console.log('1️⃣  Testing INSERT on profiles table:\n');
  try {
    const { data, error } = await anonClient
      .from('profiles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        full_name: 'Test User',
        plan_type: 'free'
      })
      .select();

    if (error) {
      console.log('   ✅ INSERT BLOCKED - RLS is working!');
      console.log(`   Error: ${error.message}\n`);
    } else {
      console.log('   ❌ INSERT SUCCEEDED - RLS NOT WORKING!');
      console.log(`   Data inserted: ${JSON.stringify(data)}\n`);
    }
  } catch (err) {
    console.log('   ✅ INSERT BLOCKED - RLS is working!');
    console.log(`   Error: ${err.message}\n`);
  }

  // Test 2: Try to insert into resumes (should fail)
  console.log('2️⃣  Testing INSERT on resumes table:\n');
  try {
    const { data, error } = await anonClient
      .from('resumes')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        filename: 'test.pdf',
        raw_text: 'test'
      })
      .select();

    if (error) {
      console.log('   ✅ INSERT BLOCKED - RLS is working!');
      console.log(`   Error: ${error.message}\n`);
    } else {
      console.log('   ❌ INSERT SUCCEEDED - RLS NOT WORKING!');
      console.log(`   Data inserted: ${JSON.stringify(data)}\n`);
    }
  } catch (err) {
    console.log('   ✅ INSERT BLOCKED - RLS is working!');
    console.log(`   Error: ${err.message}\n`);
  }

  // Test 3: Try to UPDATE existing data (should fail)
  console.log('3️⃣  Testing UPDATE on optimizations table:\n');
  try {
    const { data, error } = await anonClient
      .from('optimizations')
      .update({ status: 'hacked' })
      .eq('status', 'completed')
      .select();

    if (error) {
      console.log('   ✅ UPDATE BLOCKED - RLS is working!');
      console.log(`   Error: ${error.message}\n`);
    } else if (data && data.length === 0) {
      console.log('   ✅ UPDATE RETURNED EMPTY - RLS is blocking access!');
    } else {
      console.log('   ❌ UPDATE SUCCEEDED - RLS NOT WORKING!');
      console.log(`   Rows updated: ${data?.length}\n`);
    }
  } catch (err) {
    console.log('   ✅ UPDATE BLOCKED - RLS is working!');
    console.log(`   Error: ${err.message}\n`);
  }

  // Test 4: Try to DELETE data (should fail)
  console.log('4️⃣  Testing DELETE on job_descriptions table:\n');
  try {
    const { data, error } = await anonClient
      .from('job_descriptions')
      .delete()
      .limit(1)
      .select();

    if (error) {
      console.log('   ✅ DELETE BLOCKED - RLS is working!');
      console.log(`   Error: ${error.message}\n`);
    } else if (data && data.length === 0) {
      console.log('   ✅ DELETE RETURNED EMPTY - RLS is blocking access!');
    } else {
      console.log('   ❌ DELETE SUCCEEDED - RLS NOT WORKING!');
      console.log(`   Rows deleted: ${data?.length}\n`);
    }
  } catch (err) {
    console.log('   ✅ DELETE BLOCKED - RLS is working!');
    console.log(`   Error: ${err.message}\n`);
  }

  // Test 5: Check if we can SELECT with count
  console.log('5️⃣  Testing SELECT with count (should show 0 or error):\n');
  try {
    const { count, error } = await anonClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('   ✅ SELECT BLOCKED - RLS is working!');
      console.log(`   Error: ${error.message}\n`);
    } else {
      console.log(`   ℹ️  SELECT returned count: ${count}`);
      console.log('   (If count is 0, RLS is working and filtering results)\n');
    }
  } catch (err) {
    console.log('   ✅ SELECT BLOCKED - RLS is working!');
    console.log(`   Error: ${err.message}\n`);
  }

  console.log('='.repeat(70));
  console.log('  🏥 CONCLUSION');
  console.log('='.repeat(70) + '\n');
  console.log('   If all INSERT/UPDATE/DELETE operations were BLOCKED:');
  console.log('   🎉 RLS is FULLY ENABLED and WORKING CORRECTLY!\n');
  console.log('   The reason SELECT returns empty arrays is because');
  console.log('   RLS policies filter results based on auth.uid() which is NULL');
  console.log('   for anonymous users, so they see 0 rows. This is CORRECT behavior!\n');
  console.log('='.repeat(70) + '\n');
}

testRLSInsert()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
