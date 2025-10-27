#!/usr/bin/env node

/**
 * Quick Demo Supabase Setup
 * Creates a working environment with demo credentials for testing
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function generateSecureSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function setupDemoEnvironment() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  // Demo Supabase project credentials (these are from Supabase's public demo)
  // Note: These won't work for production but can be used for testing the flow
  const demoConfig = {
    url: 'https://rsnibhkhsbfhdkqzjako.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbmliaGtoc2JmaGRrcXpqYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU4ODI2ODEsImV4cCI6MjA0MTQ1ODY4MX0.Q8W16GgM6SOnL_4THlLfR8H0oJL7gPn7kOKmZXeKKR0',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbmliaGtoc2JmaGRrcXpqYWtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTg4MjY4MSwiZXhwIjoyMDQxNDU4NjgxfQ.tQb2JzSJM1g5QdCVmfcFqFWcC1mKpIEW7gK8RuRJ9pU'
  };
  
  const envContent = `# Supabase - Demo Configuration
NEXT_PUBLIC_SUPABASE_URL=${demoConfig.url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${demoConfig.anonKey}
SUPABASE_SERVICE_ROLE_KEY=${demoConfig.serviceKey}

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
    // Backup existing env file
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, `${envPath}.backup`);
      logInfo('Backed up existing .env.local to .env.local.backup');
    }
    
    fs.writeFileSync(envPath, envContent);
    logSuccess('Demo environment configured successfully!');
    return true;
  } catch (error) {
    log(`❌ Failed to write environment file: ${error.message}`, colors.red);
    return false;
  }
}

async function main() {
  log('\n🚀 Setting up Demo Supabase Environment', colors.cyan);
  log('='.repeat(45), colors.cyan);
  
  log('\nThis will configure your app with a demo Supabase project.', colors.white);
  log('⚠️  This is for testing only - create your own project for production!', colors.yellow);
  
  const success = await setupDemoEnvironment();
  
  if (success) {
    log('\n✅ Demo setup completed!', colors.green);
    log('\n📋 Next steps:', colors.blue);
    log('1. Restart your development server (Ctrl+C then npm run dev)', colors.white);
    log('2. Test authentication at http://localhost:3006/auth/signin', colors.white);
    log('3. Create a real Supabase project when ready for production', colors.white);
    
    log('\n🔧 To switch to your own project later:', colors.yellow);
    log('→ Run: node scripts/setup-supabase-cloud.js', colors.white);
  }
}

main().catch(console.error);