#!/usr/bin/env node

/**
 * Supabase Cloud Project Setup Script
 * This script helps create a new Supabase project and configure the environment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function generateSecureSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createEnvironmentFile(config) {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  const envContent = `# Supabase
NEXT_PUBLIC_SUPABASE_URL=${config.url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.anonKey}
SUPABASE_SERVICE_ROLE_KEY=${config.serviceKey}

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key_placeholder

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_placeholder
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_placeholder

# Next.js
NEXTAUTH_SECRET=${generateSecureSecret()}
NEXTAUTH_URL=http://localhost:3006
`;

  try {
    fs.writeFileSync(envPath, envContent);
    logSuccess('Environment file updated successfully!');
    return true;
  } catch (error) {
    logError(`Failed to write environment file: ${error.message}`);
    return false;
  }
}

async function main() {
  log('\n🚀 Supabase Cloud Project Setup', colors.cyan);
  log('='.repeat(40), colors.cyan);
  
  log('\nThis script will help you set up your Supabase project for the AI Resume Optimizer.', colors.white);
  
  log('\n📋 Prerequisites:', colors.yellow);
  log('1. A Supabase account (free at https://supabase.com)', colors.white);
  log('2. A new project created in your Supabase dashboard', colors.white);
  log('3. Your project credentials (URL and API keys)', colors.white);
  
  const proceed = await askQuestion('\nDo you have a Supabase project ready? (y/N): ');
  
  if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
    log('\n📖 How to create a Supabase project:', colors.blue);
    log('1. Visit https://supabase.com and sign up/in', colors.white);
    log('2. Click "New project"', colors.white);
    log('3. Choose organization and fill in:', colors.white);
    log('   - Project name: resume-builder-ai', colors.white);
    log('   - Database password: (generate a strong one)', colors.white);
    log('   - Region: (choose closest to you)', colors.white);
    log('4. Wait 2-3 minutes for project creation', colors.white);
    log('5. Run this script again once ready', colors.white);
    
    rl.close();
    return;
  }
  
  log('\n🔑 Enter your Supabase project credentials:', colors.cyan);
  log('(Find these in Project Settings > API)', colors.white);
  
  const url = await askQuestion('Project URL (https://xyz.supabase.co): ');
  const anonKey = await askQuestion('Anon/Public key (eyJhbGciOiJ...): ');
  const serviceKey = await askQuestion('Service Role key (eyJhbGciOiJ...): ');
  
  // Validate inputs
  if (!url || !url.includes('supabase.co')) {
    logError('Invalid Supabase URL. Please check and try again.');
    rl.close();
    return;
  }
  
  if (!anonKey || !anonKey.startsWith('eyJ')) {
    logError('Invalid anon key format. Should start with "eyJ".');
    rl.close();
    return;
  }
  
  if (!serviceKey || !serviceKey.startsWith('eyJ')) {
    logError('Invalid service role key format. Should start with "eyJ".');
    rl.close();
    return;
  }
  
  const config = { url, anonKey, serviceKey };
  
  log('\n💾 Updating environment file...', colors.cyan);
  const success = await createEnvironmentFile(config);
  
  if (success) {
    log('\n✅ Setup completed successfully!', colors.green);
    log('\n📋 Next steps:', colors.yellow);
    log('1. Apply the database schema to your Supabase project:', colors.white);
    log('   → Copy and run supabase/schema.sql in SQL Editor', colors.white);
    log('2. Test the connection:', colors.white);
    log('   → Run: node scripts/test-supabase-connection.js', colors.white);
    log('3. Restart your development server:', colors.white);
    log('   → The app will now connect to your Supabase project', colors.white);
  }
  
  rl.close();
}

main().catch(console.error);
