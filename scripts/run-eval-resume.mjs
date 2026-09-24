#!/usr/bin/env node
/**
 * Cross-platform wrapper for the resume-optimizer evals.
 *
 *   npm run eval:resume            nightly eval: 7 cases, one run each (paid)
 *   npm run eval:resume:estimate   repeat-eval cost estimate (free, no key needed)
 *   npm run eval:resume:repeat     repeat eval: 20 cases x 3 runs (paid, needs EVAL_COST_CAP_USD)
 *
 * `RUN_LIVE_EVAL=1 jest ...` is POSIX-only inline env syntax and fails on
 * Windows cmd.exe (the default shell npm uses there). This avoids adding
 * cross-env as a new dependency by setting the env var in Node itself before
 * spawning jest.
 *
 * It also loads .env.local and preflights the API key. Loading env here rather
 * than in jest.setup.js keeps real credentials scoped to the paid evals - the
 * normal mocked test suite must never pick up a live key by accident.
 * EVAL_ENV_FILE points at a different env file, for a git worktree that has no
 * .env.local of its own.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args.includes('--repeat') ? 'repeat' : args.includes('--estimate') ? 'estimate' : 'nightly';

// Local runs read the key from .env.local (gitignored); CI injects it as a repo
// secret. dotenv does not override an already-set variable, so the CI secret and
// any explicitly exported key both win over the file.
const envFile = process.env.EVAL_ENV_FILE
  ? path.resolve(process.env.EVAL_ENV_FILE)
  : path.join(repoRoot, '.env.local');
if (existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

// An eval must not write to product analytics. .env.local carries the PostHog key,
// and the optimizer traces every model call to PostHog, so without this a local
// eval run sends synthetic résumés to the production project as $ai_generation
// events. Empty strings, not deletion: @next/env only fills variables that are
// undefined, so an empty value stays empty inside jest.
const childEnv = { ...process.env, POSTHOG_API_KEY: '', NEXT_PUBLIC_POSTHOG_KEY: '' };

// Resolved through Node rather than node_modules/.bin, so it also works from a git
// worktree that shares its parent checkout's node_modules.
const jestBin = createRequire(import.meta.url).resolve('jest/bin/jest');

function runJest(testFile, extraEnv) {
  const result = spawnSync(process.execPath, [jestBin, testFile, '--runInBand'], {
    stdio: 'inherit',
    env: { ...childEnv, ...extraEnv },
  });
  process.exit(result.status ?? 1);
}

const REPEAT_TEST = 'evals/resume-optimizer/optimize-eval.repeat.live.test.ts';

if (mode === 'estimate') {
  runJest(REPEAT_TEST, { EVAL_ESTIMATE: '1', RUN_REPEAT_EVAL: '' });
}

// Without this, a missing key surfaces from inside the optimizer pipeline as a
// generic "Failed to optimize resume in pipeline pass 1" stack trace, which reads
// like an optimizer regression. It is not: it is a setup gap. The nightly job
// failed 25 straight runs on exactly this and the error never said so.
if (!process.env.OPENAI_API_KEY) {
  console.error(
    'OPENAI_API_KEY is not set, so the resume-optimizer eval cannot run.\n' +
      'This is a setup gap, NOT an optimizer quality regression.\n' +
      '  CI:    add the repo secret -> gh secret set OPENAI_API_KEY\n' +
      '  Local: add OPENAI_API_KEY to .env.local (gitignored), or set EVAL_ENV_FILE'
  );
  process.exit(1);
}

if (mode === 'repeat') {
  const cap = Number(process.env.EVAL_COST_CAP_USD);
  if (!Number.isFinite(cap) || cap <= 0) {
    console.error(
      'The repeat eval spends real money and needs an approved cap.\n' +
        '  1. npm run eval:resume:estimate\n' +
        '  2. EVAL_COST_CAP_USD=<approved dollars> npm run eval:resume:repeat'
    );
    process.exit(1);
  }
  runJest(REPEAT_TEST, { RUN_REPEAT_EVAL: '1', EVAL_ESTIMATE: '' });
}

runJest('evals/resume-optimizer/optimize-eval.live.test.ts', { RUN_LIVE_EVAL: '1' });
