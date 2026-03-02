#!/usr/bin/env node
/**
 * Deployment Verification Script
 * Checks Supabase tables and configuration
 * Run: node scripts/verify-deployment.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('🔍 Verifying Supabase Tables...\n');

  const tablesToCheck = [
    'anonymous_ats_scores',
    'rate_limits',
    'newsletter_subscribers',
    'profiles',
    'resumes',
    'job_descriptions',
    'optimizations',
    'templates'
  ];

  let allGood = true;

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: MISSING or NO ACCESS`);
        console.log(`   Error: ${error.message}`);
        allGood = false;
      } else {
        console.log(`✅ ${table}: EXISTS`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ERROR - ${err.message}`);
      allGood = false;
    }
  }

  return allGood;
}

async function checkAnonymousScoring() {
  console.log('\n🔍 Testing Anonymous ATS Scoring...\n');

  try {
    // Try to insert a test record
    const testRecord = {
      session_id: 'test_' + Date.now(),
      ip_address: '127.0.0.1',
      ats_score: 85,
      ats_subscores: { keywords: 80, format: 90 },
      ats_suggestions: { tips: ['Test tip'] },
      resume_hash: 'test_hash',
      job_description_hash: 'test_jd_hash'
    };

    const { data, error } = await supabase
      .from('anonymous_ats_scores')
      .insert(testRecord)
      .select();

    if (error) {
      console.log('❌ Anonymous scoring insert FAILED');
      console.log(`   Error: ${error.message}`);
      return false;
    }

    console.log('✅ Anonymous scoring insert SUCCESS');

    // Clean up test record
    if (data && data[0]) {
      await supabase
        .from('anonymous_ats_scores')
        .delete()
        .eq('id', data[0].id);
      console.log('✅ Test record cleaned up');
    }

    return true;
  } catch (err) {
    console.log('❌ Anonymous scoring test ERROR');
    console.log(`   Error: ${err.message}`);
    return false;
  }
}

async function checkRateLimiting() {
  console.log('\n🔍 Testing Rate Limiting...\n');

  try {
    const testIdentifier = 'test_ip_' + Date.now();

    const { data, error } = await supabase
      .from('rate_limits')
      .insert({
        identifier: testIdentifier,
        endpoint: '/api/public/ats-check',
        requests_count: 1
      })
      .select();

    if (error) {
      console.log('❌ Rate limiting insert FAILED');
      console.log(`   Error: ${error.message}`);
      return false;
    }

    console.log('✅ Rate limiting insert SUCCESS');

    // Clean up
    if (data && data[0]) {
      await supabase
        .from('rate_limits')
        .delete()
        .eq('id', data[0].id);
      console.log('✅ Test record cleaned up');
    }

    return true;
  } catch (err) {
    console.log('❌ Rate limiting test ERROR');
    console.log(`   Error: ${err.message}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('\n🔍 Checking Environment Variables...\n');

  const requiredVars = {
    'NEXT_PUBLIC_SUPABASE_URL': supabaseUrl,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': supabaseKey,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'RESEND_API_KEY': process.env.RESEND_API_KEY,
    'NEXT_PUBLIC_POSTHOG_KEY': process.env.NEXT_PUBLIC_POSTHOG_KEY,
    'NEXT_PUBLIC_POSTHOG_HOST': process.env.NEXT_PUBLIC_POSTHOG_HOST
  };

  const optionalVars = {
    'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
    'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET
  };

  let allRequired = true;

  console.log('Required Variables:');
  for (const [name, value] of Object.entries(requiredVars)) {
    if (value && value !== 'your_key_here' && value !== 'undefined') {
      console.log(`✅ ${name}`);
    } else {
      console.log(`❌ ${name}: MISSING or PLACEHOLDER`);
      allRequired = false;
    }
  }

  console.log('\nOptional Variables (for payments):');
  for (const [name, value] of Object.entries(optionalVars)) {
    if (value && value !== 'your_stripe_secret_key_here' && value !== 'your_stripe_webhook_secret_here') {
      console.log(`✅ ${name}`);
    } else {
      console.log(`⚠️  ${name}: PLACEHOLDER (set when ready for payments)`);
    }
  }

  return allRequired;
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ResumeBuilder AI - Deployment Verification');
  console.log('═══════════════════════════════════════════════\n');

  const tablesOk = await verifyTables();
  const envOk = await checkEnvironmentVariables();
  const anonymousOk = await checkAnonymousScoring();
  const rateLimitOk = await checkRateLimiting();

  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Database Tables: ${tablesOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Environment Vars: ${envOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Anonymous Scoring: ${anonymousOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Rate Limiting: ${rateLimitOk ? '✅ PASS' : '❌ FAIL'}`);

  if (tablesOk && envOk && anonymousOk && rateLimitOk) {
    console.log('\n🎉 ALL CHECKS PASSED - Ready to launch!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME CHECKS FAILED - Review errors above\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 Script error:', err);
  process.exit(1);
});
