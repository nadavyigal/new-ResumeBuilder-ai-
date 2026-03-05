#!/usr/bin/env node

/**
 * Buttondown Email Setup Script
 *
 * Creates the 3-email welcome sequence as drafts in Buttondown.
 * Automations (timing/triggers) must be configured in the Buttondown dashboard.
 *
 * Usage:
 *   BUTTONDOWN_API_KEY=your-key-here node scripts/buttondown-emails/setup-buttondown.mjs
 *
 * Or set the env var first:
 *   export BUTTONDOWN_API_KEY=your-key-here
 *   node scripts/buttondown-emails/setup-buttondown.mjs
 *
 * Find your API key at: https://buttondown.com/settings
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.BUTTONDOWN_API_KEY;
const API_BASE = 'https://api.buttondown.com/v1';

if (!API_KEY) {
  console.error('');
  console.error('  ERROR: BUTTONDOWN_API_KEY environment variable is required.');
  console.error('');
  console.error('  Find your API key at: https://buttondown.com/settings');
  console.error('');
  console.error('  Usage:');
  console.error('    BUTTONDOWN_API_KEY=your-key node scripts/buttondown-emails/setup-buttondown.mjs');
  console.error('');
  process.exit(1);
}

// Email definitions
const emails = [
  {
    name: 'Email 1: Welcome + Quick Wins (D0)',
    subject: "Your ATS score is ready. Here's what to fix first.",
    file: 'email-1-welcome.html',
    metadata: { sequence_position: 1, send_delay_days: 0 },
  },
  {
    name: 'Email 2: Value + Customization (D3)',
    subject: 'The resume mistake that costs the most interviews',
    file: 'email-2-value.html',
    metadata: { sequence_position: 2, send_delay_days: 3 },
  },
  {
    name: 'Email 3: Premium Conversion (D7)',
    subject: 'What changes when you upgrade your resume workflow',
    file: 'email-3-conversion.html',
    metadata: { sequence_position: 3, send_delay_days: 7 },
  },
];

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Token ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API ${method} ${endpoint} failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function verifyConnection() {
  console.log('Verifying Buttondown API connection...');
  try {
    const data = await apiRequest('/newsletters');
    // If we get here, the connection is good
    console.log('  Connected successfully.');
    return true;
  } catch (err) {
    // Try the ping endpoint or just check auth
    try {
      const response = await fetch(`${API_BASE}/emails`, {
        headers: { 'Authorization': `Token ${API_KEY}` },
      });
      if (response.ok) {
        console.log('  Connected successfully.');
        return true;
      }
      console.error(`  Connection failed: HTTP ${response.status}`);
      return false;
    } catch (e) {
      console.error(`  Connection failed: ${e.message}`);
      return false;
    }
  }
}

async function listExistingEmails() {
  console.log('Checking for existing emails...');
  try {
    const data = await apiRequest('/emails');
    const results = data.results || data;
    if (Array.isArray(results) && results.length > 0) {
      console.log(`  Found ${results.length} existing email(s):`);
      for (const email of results.slice(0, 10)) {
        console.log(`    - "${email.subject}" (status: ${email.status})`);
      }
    } else {
      console.log('  No existing emails found.');
    }
    return results || [];
  } catch (err) {
    console.log(`  Could not list emails: ${err.message}`);
    return [];
  }
}

async function createEmailDraft(emailDef) {
  const htmlContent = readFileSync(join(__dirname, emailDef.file), 'utf-8');

  console.log(`\nCreating draft: "${emailDef.name}"...`);
  console.log(`  Subject: ${emailDef.subject}`);

  try {
    const result = await apiRequest('/emails', 'POST', {
      subject: emailDef.subject,
      body: htmlContent,
      status: 'draft',
      metadata: emailDef.metadata,
    });

    console.log(`  Created successfully (ID: ${result.id})`);
    return result;
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Resumely - Buttondown Welcome Sequence Setup');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Verify connection
  const connected = await verifyConnection();
  if (!connected) {
    console.error('\nCould not connect to Buttondown API. Check your API key.');
    process.exit(1);
  }

  // Step 2: List existing emails
  const existing = await listExistingEmails();

  // Step 3: Check for duplicates
  const existingSubjects = new Set(existing.map(e => e.subject));
  const toCreate = emails.filter(e => !existingSubjects.has(e.subject));
  const skipped = emails.filter(e => existingSubjects.has(e.subject));

  if (skipped.length > 0) {
    console.log(`\nSkipping ${skipped.length} email(s) that already exist:`);
    for (const s of skipped) {
      console.log(`  - "${s.subject}"`);
    }
  }

  if (toCreate.length === 0) {
    console.log('\nAll 3 emails already exist in Buttondown. Nothing to create.');
  } else {
    console.log(`\nCreating ${toCreate.length} email draft(s)...`);

    const results = [];
    for (const emailDef of toCreate) {
      const result = await createEmailDraft(emailDef);
      results.push({ ...emailDef, result });
    }

    const succeeded = results.filter(r => r.result);
    const failed = results.filter(r => !r.result);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Results: ${succeeded.length} created, ${failed.length} failed, ${skipped.length} skipped`);
    console.log(`${'='.repeat(60)}`);
  }

  // Step 4: Automation instructions
  console.log('');
  console.log('-'.repeat(60));
  console.log('  NEXT: Set Up Automations in Buttondown Dashboard');
  console.log('-'.repeat(60));
  console.log('');
  console.log('  The 3 emails are now saved as drafts in Buttondown.');
  console.log('  To create the welcome sequence automation:');
  console.log('');
  console.log('  1. Go to https://buttondown.com/automations');
  console.log('  2. Create 3 automations:');
  console.log('');
  console.log('     Automation 1: "Welcome Email"');
  console.log('       Trigger: When a subscriber confirms their subscription');
  console.log('       Timing: Immediately');
  console.log('       Email: "Your ATS score is ready..."');
  console.log('');
  console.log('     Automation 2: "Value Email (D3)"');
  console.log('       Trigger: When a subscriber confirms their subscription');
  console.log('       Timing: After 3 days');
  console.log('       Email: "The resume mistake that costs..."');
  console.log('');
  console.log('     Automation 3: "Conversion Email (D7)"');
  console.log('       Trigger: When a subscriber confirms their subscription');
  console.log('       Timing: After 7 days');
  console.log('       Email: "What changes when you upgrade..."');
  console.log('');
  console.log('  3. Test by subscribing with a test email address.');
  console.log('');
  console.log('='.repeat(60));
  console.log('  Setup complete!');
  console.log('='.repeat(60));
  console.log('');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
