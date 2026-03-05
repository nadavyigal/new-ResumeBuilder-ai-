#!/usr/bin/env node

/**
 * Creates welcome sequence automations in Buttondown via API.
 * Usage: BUTTONDOWN_API_KEY=xxx node scripts/buttondown-emails/create-automations.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.BUTTONDOWN_API_KEY;
const API_BASE = 'https://api.buttondown.com/v1';

if (!API_KEY) {
  console.error('BUTTONDOWN_API_KEY required');
  process.exit(1);
}

const automations = [
  {
    name: 'Resumely Welcome Sequence - Email 1 (D0)',
    trigger: 'subscriber.confirmed',
    timing: { time: 'immediate' },
    file: 'email-1-welcome.html',
    subject: "Your ATS score is ready. Here's what to fix first.",
  },
  {
    name: 'Resumely Welcome Sequence - Email 2 (D3)',
    trigger: 'subscriber.confirmed',
    timing: { time: 'delay', delay: { value: 3, unit: 'days' } },
    file: 'email-2-value.html',
    subject: 'The resume mistake that costs the most interviews',
  },
  {
    name: 'Resumely Welcome Sequence - Email 3 (D7)',
    trigger: 'subscriber.confirmed',
    timing: { time: 'delay', delay: { value: 7, unit: 'days' } },
    file: 'email-3-conversion.html',
    subject: 'What changes when you upgrade your resume workflow',
  },
];

async function createAutomation(auto) {
  const body = readFileSync(join(__dirname, auto.file), 'utf-8');

  const payload = {
    name: auto.name,
    trigger: auto.trigger,
    timing: auto.timing,
    actions: [{
      type: 'send_email',
      metadata: {
        subject: auto.subject,
        body: body,
      },
    }],
    filters: { filters: [], groups: [], predicate: 'and' },
  };

  const resp = await fetch(`${API_BASE}/automations`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.log(`FAILED: ${auto.name}`);
    console.log(`  Error: ${JSON.stringify(data)}`);
    return null;
  }
  console.log(`CREATED: ${auto.name}`);
  console.log(`  ID: ${data.id}`);
  console.log(`  Status: ${data.status}`);
  console.log(`  Timing: ${JSON.stringify(data.timing)}`);
  return data;
}

async function activateAutomation(id, name) {
  const resp = await fetch(`${API_BASE}/automations/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Token ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'active' }),
  });
  if (resp.ok) {
    console.log(`  ACTIVATED: ${name}`);
  } else {
    const data = await resp.json();
    console.log(`  Could not activate: ${JSON.stringify(data)}`);
  }
}

async function main() {
  console.log('');
  console.log('Creating 3 welcome sequence automations...');
  console.log('');

  const created = [];
  for (const auto of automations) {
    const result = await createAutomation(auto);
    if (result) {
      created.push({ ...auto, id: result.id });
    }
    console.log('');
  }

  // Activate all created automations
  if (created.length > 0) {
    console.log('Activating automations...');
    for (const a of created) {
      await activateAutomation(a.id, a.name);
    }
    console.log('');
  }

  // List all automations
  const resp = await fetch(`${API_BASE}/automations`, {
    headers: { Authorization: `Token ${API_KEY}` },
  });
  const data = await resp.json();
  console.log(`Total automations in Buttondown: ${data.count}`);
  for (const a of (data.results || [])) {
    console.log(`  - ${a.name} (${a.status}, trigger: ${a.trigger}, timing: ${JSON.stringify(a.timing)})`);
  }
  console.log('');
  console.log('Done! Welcome sequence is now active in Buttondown.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
