/**
 * Test script to debug upload-resume API errors
 * Run with: node test-upload-api.js
 */

const fs = require('fs');
const path = require('path');

async function testUploadAPI() {
  console.log('=== Testing Upload Resume API ===\n');

  // 1. Test Environment Variables
  console.log('1. Checking environment variables:');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✓ ${envVar}: SET (length: ${value.length})`);
    } else {
      console.log(`   ✗ ${envVar}: NOT SET`);
    }
  }

  // 2. Test pdf-parse module
  console.log('\n2. Testing pdf-parse module:');
  try {
    const pdfParse = require('pdf-parse');
    console.log('   ✓ pdf-parse module loaded successfully');
    console.log(`   Type: ${typeof pdfParse}`);
  } catch (error) {
    console.error('   ✗ Failed to load pdf-parse:', error.message);
  }

  // 3. Test OpenAI client initialization
  console.log('\n3. Testing OpenAI client:');
  try {
    const { OpenAI } = await import('openai');
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('   ✗ OPENAI_API_KEY not set');
    } else {
      const openai = new OpenAI({ apiKey });
      console.log('   ✓ OpenAI client initialized successfully');
    }
  } catch (error) {
    console.error('   ✗ Failed to initialize OpenAI client:', error.message);
  }

  // 4. Test Supabase client
  console.log('\n4. Testing Supabase client:');
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('   ✗ Supabase credentials not set');
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('   ✓ Supabase client initialized successfully');

      // Test connection
      const { error } = await supabase.from('profiles').select('count').limit(1);
      if (error) {
        console.error(`   ⚠ Supabase connection test failed: ${error.message}`);
      } else {
        console.log('   ✓ Supabase connection test passed');
      }
    }
  } catch (error) {
    console.error('   ✗ Failed to test Supabase:', error.message);
  }

  // 5. Check Next.js config
  console.log('\n5. Checking Next.js configuration:');
  const nextConfigPath = path.join(__dirname, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    console.log('   ✓ next.config.ts exists');
    const configContent = fs.readFileSync(nextConfigPath, 'utf-8');
    if (configContent.includes('pdf-parse')) {
      console.log('   ✓ pdf-parse is externalized in webpack config');
    } else {
      console.log('   ⚠ pdf-parse externalization not found in config');
    }
  }

  console.log('\n=== Test Complete ===');
}

// Load environment variables from .env.local
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
    console.log('✓ Loaded .env.local\n');
  }
} catch (error) {
  console.warn('⚠ Could not load .env.local:', error.message, '\n');
}

testUploadAPI().catch(console.error);
