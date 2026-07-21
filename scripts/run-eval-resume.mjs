#!/usr/bin/env node
/**
 * Cross-platform wrapper for `npm run eval:resume`.
 *
 * `RUN_LIVE_EVAL=1 jest ...` is POSIX-only inline env syntax and fails on
 * Windows cmd.exe (the default shell npm uses there). This avoids adding
 * cross-env as a new dependency by setting the env var in Node itself before
 * spawning jest.
 *
 * It also loads .env.local and preflights the API key. Loading env here rather
 * than in jest.setup.js keeps real credentials scoped to this one paid eval -
 * the normal mocked test suite must never pick up a live key by accident.
 *
 * Usage: node scripts/run-eval-resume.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Local runs read the key from .env.local (gitignored); CI injects it as a repo
// secret. dotenv does not override an already-set variable, so the CI secret and
// any explicitly exported key both win over the file.
const envLocal = path.join(repoRoot, '.env.local');
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
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
      '  Local: add OPENAI_API_KEY to .env.local (gitignored)'
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['node_modules/.bin/jest', 'evals/resume-optimizer/optimize-eval.live.test.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, RUN_LIVE_EVAL: '1' },
  }
);

process.exit(result.status ?? 1);
