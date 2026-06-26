#!/usr/bin/env node
/**
 * Cross-platform wrapper for `npm run eval:resume`.
 *
 * `RUN_LIVE_EVAL=1 jest ...` is POSIX-only inline env syntax and fails on
 * Windows cmd.exe (the default shell npm uses there). This avoids adding
 * cross-env as a new dependency by setting the env var in Node itself before
 * spawning jest.
 *
 * Usage: node scripts/run-eval-resume.mjs
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/.bin/jest', 'evals/resume-optimizer/optimize-eval.live.test.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, RUN_LIVE_EVAL: '1' },
  }
);

process.exit(result.status ?? 1);
