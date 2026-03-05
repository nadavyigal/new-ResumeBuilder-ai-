#!/usr/bin/env node

/**
 * Production Deployment Verification Script
 * 
 * This script helps verify that your Vercel production deployment
 * includes the latest ATS v2 features.
 */

console.log('\n🔍 Production Deployment Verification\n');
console.log('=' .repeat(50));

// Get the latest commit
const { execSync } = require('child_process');

try {
  const latestCommit = execSync('git log -1 --oneline', { encoding: 'utf-8' }).trim();
  console.log('\n✅ Latest Git Commit:');
  console.log(`   ${latestCommit}`);

  const commitHash = latestCommit.split(' ')[0];
  console.log(`\n📦 Commit Hash: ${commitHash}`);
  
  // Check if there are any uncommitted changes
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (status) {
    console.log('\n⚠️  WARNING: You have uncommitted changes:');
    console.log(status.split('\n').map(line => `   ${line}`).join('\n'));
    console.log('\n   These changes are NOT deployed to production.');
  } else {
    console.log('\n✅ No uncommitted changes - working tree is clean');
  }

  // Check if we're on main branch
  const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  console.log(`\n🌿 Current Branch: ${branch}`);
  if (branch !== 'main') {
    console.log('   ⚠️  You are not on the main branch. Production deploys from main.');
  }

  // Check key files exist
  console.log('\n📂 Verifying Key Files:');
  const fs = require('fs');
  const path = require('path');
  
  const keyFiles = [
    'src/components/ats/CompactATSScoreCard.tsx',
    'src/components/ats/SubScoreBreakdown.tsx',
    'src/app/dashboard/optimizations/[id]/page.tsx',
  ];

  let allFilesExist = true;
  for (const file of keyFiles) {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ ${file}`);
    } else {
      console.log(`   ❌ ${file} - MISSING!`);
      allFilesExist = false;
    }
  }

  if (allFilesExist) {
    console.log('\n✅ All key ATS v2 files are present');
  } else {
    console.log('\n❌ Some key files are missing - deployment may fail');
  }

  // Provide next steps
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Next Steps:');
  console.log('\n1. Go to your Vercel Dashboard:');
  console.log('   https://vercel.com/dashboard');
  console.log('\n2. Find your project and check the "Deployments" tab');
  console.log(`\n3. Verify the latest deployment matches commit: ${commitHash}`);
  console.log('\n4. If the deployment is stuck or failed:');
  console.log('   - Click "Redeploy" on the latest production deployment');
  console.log('   - Or: Settings → Clear Cache → Redeploy');
  console.log('\n5. After deployment completes, hard refresh your browser:');
  console.log('   - Windows: Ctrl + Shift + R');
  console.log('   - Mac: Cmd + Shift + R');
  
  console.log('\n✨ Expected Features on Production:');
  console.log('   • Green ATS Score Card at top of optimization page');
  console.log('   • Original vs Optimized scores (e.g., 71% → 74%, +3)');
  console.log('   • "Details" button that opens score breakdown modal');
  console.log('   • 8 sub-scores with progress bars and tooltips');
  console.log('   • ATS Improvement Tips in AI Assistant sidebar');
  
  console.log('\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}

