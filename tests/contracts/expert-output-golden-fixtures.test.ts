import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const fixtureRoot = path.join(process.cwd(), 'tests/fixtures/expert-golden');

describe('Expert output golden fixtures', () => {
  it.each(['mobile-platform', 'customer-success'])('%s has a repeatable resume/job pair', (name) => {
    const resumePath = path.join(fixtureRoot, name, 'resume.json');
    const jobPath = path.join(fixtureRoot, name, 'job.txt');

    const resume = JSON.parse(fs.readFileSync(resumePath, 'utf8')) as Record<string, unknown>;
    const job = fs.readFileSync(jobPath, 'utf8');

    expect(typeof resume.summary).toBe('string');
    expect(Array.isArray(resume.experience)).toBe(true);
    expect(Array.isArray(resume.education)).toBe(true);
    expect(typeof job).toBe('string');
    expect(job.trim().length).toBeGreaterThan(80);
  });
});
