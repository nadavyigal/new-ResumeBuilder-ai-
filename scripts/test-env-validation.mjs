/**
 * Test script to verify environment variable validation
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 Testing Environment Variable Validation...\n');

// Test required variables
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

const optional = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PREMIUM_PRICE_ID',
];

let hasErrors = false;

console.log('📋 Required Variables:');
for (const key of required) {
  const value = process.env[key];
  if (!value) {
    console.log(`  ❌ ${key} - MISSING`);
    hasErrors = true;
  } else {
    const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    console.log(`  ✅ ${key} - ${masked}`);
  }
}

console.log('\n📋 Optional Variables (for Stripe):');
for (const key of optional) {
  const value = process.env[key];
  if (!value) {
    console.log(`  ⚠️  ${key} - NOT SET (Stripe features disabled)`);
  } else {
    const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    console.log(`  ✅ ${key} - ${masked}`);
  }
}

console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('❌ VALIDATION FAILED - Missing required environment variables');
  console.log('\nPlease ensure all required variables are set in .env.local');
  process.exit(1);
} else {
  console.log('✅ VALIDATION PASSED - All required variables are set');
  console.log('\n🎉 Environment is properly configured!');
  process.exit(0);
}
