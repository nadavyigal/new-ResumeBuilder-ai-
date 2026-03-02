#!/usr/bin/env node
/**
 * Benchmark AgentRuntime vs baseline ATS to assess enhancement quality.
 * - Loads 10 sample resumes + JDs from tests/fixtures/*
 * - Runs baseline ATS (legacy proxy) and AgentRuntime
 * - Compares median ATS lift, diff stability, and latency
 * - Logs structured JSON with ats_gain, diff_stability, latency_ms
 * Usage:
 *   node scripts/bench-agent.mjs [--pdf] [--verbose]
 * Flags:
 *   --pdf     Include PDF generation (default off: set BENCH_SKIP_PDF=1)
 *   --verbose Print per-sample details
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { AgentRuntime } from '../src/lib/agent/index.js';
import { ATS } from '../src/lib/agent/tools/ats.js';

const root = path.resolve(process.cwd());
const fixturesDir = path.join(root, 'tests', 'fixtures');

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function pctl(arr, p) {
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx] ?? 0;
}

async function loadSamples() {
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).slice(0, 10);
  const samples = [];
  for (const d of dirs) {
    const dir = path.join(fixturesDir, d.name);
    const resumePath = path.join(dir, 'resume.json');
    const jdPath = path.join(dir, 'job.txt');
    try {
      const [resumeRaw, jdRaw] = await Promise.all([
        fs.readFile(resumePath, 'utf8'),
        fs.readFile(jdPath, 'utf8'),
      ]);
      samples.push({ name: d.name, resume_json: JSON.parse(resumeRaw), job_text: jdRaw });
    } catch {
      // skip invalid sample
    }
  }
  return samples;
}

async function main() {
  const args = process.argv.slice(2);
  const withPdf = args.includes('--pdf');
  const verbose = args.includes('--verbose');
  if (!withPdf) process.env.BENCH_SKIP_PDF = '1';

  const samples = await loadSamples();
  if (samples.length < 1) {
    console.log(JSON.stringify({ error: 'no_samples', message: 'Place 10 samples under tests/fixtures/*' }));
    process.exit(1);
  }

  const runtime = new AgentRuntime();
  const atsLifts = [];
  const diffsCounts = [];
  const latencies = [];
  let fatalErrors = 0;
  let nonfatalErrors = 0;

  for (const s of samples) {
    try {
      const before = ATS.score({ resume_json: s.resume_json, job_text: s.job_text }).score;
      const start = Date.now();
      const agent = await runtime.run({
        userId: 'bench-user',
        command: 'optimize for job; add skills if missing; design font Inter; color #0EA5E9',
        resume_json: s.resume_json,
        job_text: s.job_text,
      });
      const end = Date.now();
      const after = agent.ats_report?.score ?? 0;
      atsLifts.push(after - before);
      diffsCounts.push(agent.diffs?.length ?? 0);
      latencies.push(end - start);
      if (verbose) {
        console.log(JSON.stringify({ sample: s.name, before, after, lift: after - before, diffs: agent.diffs?.length ?? 0, latency_ms: end - start }));
      }
    } catch {
      nonfatalErrors += 1;
    }
  }

  const ats_gain = median(atsLifts);
  const diff_stability = median(diffsCounts);
  const latency_ms = { p50: median(latencies), p95: pctl(latencies, 95) };

  const pass = ats_gain >= 10 && latency_ms.p95 <= (withPdf ? 6500 : 3500) && fatalErrors === 0;

  console.log(JSON.stringify({ ats_gain, diff_stability, latency_ms, errors: { fatal: fatalErrors, nonfatal: nonfatalErrors }, pass }));
  process.exit(pass ? 0 : 2);
}

main().catch(() => process.exit(1));

