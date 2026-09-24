import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Hashes that make "same input, same config" checkable instead of assumed.
 *
 * inputHash covers what a run is asked to do: the résumé, the job and the fixed
 * evaluation date. configHash covers what does the work: prompt source, pipeline
 * source, scorer source and version, model settings, judge versions and the harness
 * version. The git commit is recorded next to them but kept out of the hash, so a
 * docs-only commit does not make two identical configurations look different.
 */

export const HARNESS_VERSION = 'repeat-harness-2026-09-24';

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function inputHash(c: { resumeText: string; jobDescription: string }, evaluationDate: string): string {
  return sha256(JSON.stringify({ resumeText: c.resumeText, jobDescription: c.jobDescription, evaluationDate }));
}

export interface ConfigParts {
  promptSourceHash: string;
  pipelineSourceHash: string;
  scorerSourceHash: string;
  scoreVersion: string;
  optimizationModel: string;
  temperature: number;
  maxTokens: number;
  nightlyJudge: string;
  groundingJudge: string;
  harnessVersion: string;
}

export interface ConfigFingerprint extends ConfigParts {
  configHash: string;
  gitCommit: string;
  gitDirty: boolean;
}

export function configHash(parts: ConfigParts): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => [k, parts[k as keyof ConfigParts]]);
  return sha256(JSON.stringify(ordered));
}

/** Hash of every non-test .ts file under the given paths, in a stable order. */
export function hashSources(root: string, paths: string[]): string {
  const files: string[] = [];
  const walk = (p: string) => {
    const full = join(root, p);
    if (statSync(full).isDirectory()) {
      for (const entry of readdirSync(full).sort()) walk(join(p, entry));
    } else if (/\.ts$/.test(full) && !/\.test\.ts$/.test(full)) {
      files.push(full);
    }
  };
  for (const p of paths) walk(p);
  const h = createHash('sha256');
  for (const f of files.sort()) {
    h.update(relative(root, f));
    h.update('\0');
    h.update(readFileSync(f));
    h.update('\0');
  }
  return h.digest('hex');
}

function git(root: string, args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export function buildConfigFingerprint(root: string, parts: Omit<ConfigParts, 'promptSourceHash' | 'pipelineSourceHash' | 'scorerSourceHash'>): ConfigFingerprint {
  const full: ConfigParts = {
    ...parts,
    promptSourceHash: hashSources(root, ['src/lib/prompts/resume-optimizer.ts']),
    pipelineSourceHash: hashSources(root, ['src/lib/ai-optimizer']),
    scorerSourceHash: hashSources(root, ['src/lib/ats']),
  };
  return {
    ...full,
    configHash: configHash(full),
    gitCommit: git(root, 'rev-parse HEAD'),
    gitDirty: git(root, 'status --porcelain') !== '',
  };
}
