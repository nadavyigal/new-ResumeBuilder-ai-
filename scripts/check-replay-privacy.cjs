/* Local browser recording proof. Fictional API responses; no external traffic or saved replay. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const origin = new URL(process.argv[2] || 'http://127.0.0.1:3105');
  assert(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Local server only');
  // Read the actual init call, rather than copying its masking options.
  let config;
  const sdk = { __loaded: false, init: (_key, options) => { config = options; } };
  const exports = {};
  vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/posthog.ts', 'utf8'), {
    module: ts.ModuleKind.CommonJS,
  }), {
    exports, require: (name) => { assert.equal(name, 'posthog-js'); return { default: sdk }; },
    window: {}, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: 'phc_fictional' } }, console,
  });
  exports.initPostHog();
  assert(config.session_recording.maskAllInputs);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const summaries = [];
  try {
    for (const scenario of ['error', 'results', 'url-error']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin.origin) return route.abort();
        if (url.pathname.startsWith('/telemetry')) return route.fulfill({ status: 200, body: '{}' });
        if (url.pathname.startsWith('/api/')) {
          if (url.pathname !== '/api/public/ats-check') return route.fulfill({ status: 200, body: '{}' });
          const payload = scenario !== 'results' ? { error: 'FICTIONAL_ERROR_SENTINEL' } : {
            success: true, sessionId: 'fictional-session', checksRemaining: 4,
            score: { overall: 62, timestamp: '2026-11-02T00:00:00Z' },
            preview: {
              topIssues: [{ id: 'a', text: 'FICTIONAL_JOB_SENTINEL', category: 'keywords', estimated_gain: 3 }],
              moreIssues: [{ id: 'b', text: 'FICTIONAL_CV_SENTINEL', category: 'content', estimated_gain: 2 }],
              totalIssues: 2, lockedCount: 0,
            },
            quickWins: [{ id: 'q', original_text: 'FICTIONAL_CV_SENTINEL', optimized_text: 'FICTIONAL_CV_SENTINEL improved', improvement_type: 'quantified_achievement', estimated_impact: 4, location: { section: 'experience' }, rationale: 'FICTIONAL_JOB_SENTINEL', keywords_added: ['FICTIONAL_JOB_SENTINEL'] }],
            fit: { verdict: 'Stretch', scoreNote: 'FICTIONAL_JOB_SENTINEL', topGaps: ['FICTIONAL_JOB_SENTINEL'], missingKeywords: ['FICTIONAL_JOB_SENTINEL'] },
          };
          return route.fulfill({ status: scenario !== 'results' ? 400 : 200, contentType: 'application/json', body: JSON.stringify(payload) });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(origin.origin + '/he', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('ats-checker-hero-cta').click();
      await page.getByTestId('resume-upload').waitFor({ state: 'attached' });
      await page.addScriptTag({ path: require.resolve('posthog-js/dist/recorder.js') });
      await page.evaluate((options) => {
        const marker = document.createElement('p');
        marker.textContent = 'PUBLIC_RECORDING_CONTROL';
        document.body.appendChild(marker);
        window.localReplay = [];
        window.stopLocalReplay = window.rrweb.record({ ...options, emit: (event) => window.localReplay.push(event) });
      }, config.session_recording);
      await page.getByTestId('resume-upload').setInputFiles({ name: 'FICTIONAL_NAME_SENTINEL.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-fictional') });
      if (scenario === 'url-error') {
        await page.getByRole('button', { name: 'מקישור', exact: true }).click();
        await page.getByTestId('job-description-url-input').fill('https://fictional.invalid/FICTIONAL_URL_SENTINEL');
      } else {
        await page.getByTestId('job-description-input').fill('FICTIONAL_INPUT_SENTINEL ' + 'fictional engineer role responsibility skill experience team product '.repeat(20));
      }
      await page.getByTestId('analyze-button').click();
      const expected = scenario !== 'results' ? 'FICTIONAL_ERROR_SENTINEL' : 'FICTIONAL_JOB_SENTINEL';
      await page.getByText(expected, { exact: true }).first().waitFor();
      await page.waitForTimeout(250);
      const proof = await page.evaluate(() => {
        window.rrweb.record.takeFullSnapshot();
        window.stopLocalReplay();
        return { events: window.localReplay, dom: document.body.textContent };
      });
      assert(proof.dom.includes(expected), 'Fictional sensitive content actually rendered');
      if (scenario === 'results') assert(proof.dom.includes('FICTIONAL_CV_SENTINEL'), 'CV fixture actually rendered');
      const serialized = JSON.stringify(proof.events);
      assert(serialized.includes('PUBLIC_RECORDING_CONTROL'), 'Recording positive control');
      for (const sentinel of ['FICTIONAL_NAME_SENTINEL', 'FICTIONAL_INPUT_SENTINEL', 'FICTIONAL_ERROR_SENTINEL', 'FICTIONAL_JOB_SENTINEL', 'FICTIONAL_CV_SENTINEL', 'FICTIONAL_URL_SENTINEL']) {
        assert(!serialized.includes(sentinel), 'Replay leaked ' + sentinel);
      }
      assert(proof.events.some((event) => event.type === 2), 'Full snapshot captured');
      assert(proof.events.some((event) => event.type === 3), 'Incremental mutations captured');
      summaries.push({ scenario, events: proof.events.length, fullSnapshots: proof.events.filter((e) => e.type === 2).length, sensitiveSentinels: 'absent', publicControl: 'present' });
      await context.close();
    }
    console.log(JSON.stringify({ recorder: require('posthog-js/package.json').version, ...config.session_recording, network: 'external requests blocked; API mocked; replay retained in memory only', summaries }, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
