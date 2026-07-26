/**
 * WP-45 S3 — One canonical score per (resume, job)
 *
 * The moderated session on 2026-07-24 saw a fit score of 45 on one screen and
 * 42 on the next, for the same resume and the same job. Two causes:
 *
 *   - the free checker built the scorer's input with a hardcoded format report
 *     (safety 70) while the optimize path derived one from the resume (85 plus
 *     real detection), so the same document scored differently;
 *   - there were two near-identical copies of the orchestrator, `core.ts` and
 *     `index.ts`, reached by different call paths and free to drift.
 *
 * A user cannot be shown two numbers for one thing and be expected to trust
 * either. These tests pin the single entry point and the single input shape.
 */

import { scoreResume as scoreFromCore, SCORE_VERSION } from '../core';
import { scoreResume as scoreFromIndex } from '../index';
import { generateFormatReport } from '../integration';
import type { ATSScoreInput } from '../types';

const RESUME = `Jane Cohen
jane@example.com | Tel Aviv

PROFESSIONAL SUMMARY
Data engineer building streaming systems.

SKILLS
Kafka, Spark, SQL, Python

EXPERIENCE

Senior Data Engineer at Nimbus Analytics
Jan 2022 - Present
• Built streaming pipelines on Kafka and Spark

EDUCATION
BSc Computer Science - Technion
`;

const JOB =
  'Senior Data Engineer to build streaming pipelines with Kafka, Spark and Snowflake. SQL and Python required.';

/** Exactly how the public free checker builds its scorer input. */
function freeCheckerInput(): ATSScoreInput {
  return {
    resume_original_text: RESUME,
    resume_optimized_text: RESUME,
    job_clean_text: JOB,
    job_extracted_json: {
      title: 'Senior Data Engineer',
      must_have: ['kafka', 'spark', 'snowflake', 'sql', 'python'],
      nice_to_have: [],
      responsibilities: ['Build streaming pipelines'],
    } as ATSScoreInput['job_extracted_json'],
    format_report: generateFormatReport(RESUME),
    timestamp: new Date('2026-07-24T00:00:00Z'),
  };
}

describe('WP-45 S3: one score for one resume and job', () => {
  it('returns the same score through both public entry points', async () => {
    const [viaCore, viaIndex] = await Promise.all([
      scoreFromCore(freeCheckerInput()),
      scoreFromIndex(freeCheckerInput()),
    ]);

    expect(viaIndex.ats_score_optimized).toBe(viaCore.ats_score_optimized);
    expect(viaIndex.ats_score_original).toBe(viaCore.ats_score_original);
    expect(viaIndex.subscores).toEqual(viaCore.subscores);
  });

  it('exposes the same function object from both modules', () => {
    // The two orchestrators were separate implementations that had already
    // drifted — only one supported quick wins. Identity here is what makes
    // "the same scorer" a fact rather than an intention.
    expect(scoreFromIndex).toBe(scoreFromCore);
  });

  it('does not depend on a hardcoded format baseline', async () => {
    // The free checker's old DEFAULT_FORMAT_REPORT pinned format_safety_score
    // at 70 regardless of the resume. Deriving it from the document is what
    // makes the free checker and the optimize path agree.
    const derived = generateFormatReport(RESUME);
    expect(derived.format_safety_score).not.toBe(70);

    const result = await scoreFromCore(freeCheckerInput());
    expect(result.subscores.format_parseability).toBe(derived.format_safety_score);
  });

  it('detects real format risk from the resume rather than assuming it', () => {
    // A resume with table pipes is genuinely riskier for an ATS. The hardcoded
    // report could not tell the difference.
    const risky = generateFormatReport('Name | Role | Dates\n| a | b | c |\n');
    const clean = generateFormatReport(RESUME);
    expect(risky.has_tables).toBe(true);
    expect(clean.has_tables).toBe(false);
  });

  it('stamps every result with the scoring regime that produced it', async () => {
    // Scores are not comparable across regimes — the scale moved on
    // 2026-06-18 and again with the WP-45 repairs. Without this stamp, a
    // dashboard averaging old and new rows produces a meaningless number
    // and nobody can tell (WP-45 S9).
    const result = await scoreFromCore(freeCheckerInput());
    expect(result.metadata.score_version).toBe(SCORE_VERSION);
    expect(SCORE_VERSION).toMatch(/wp45/);
  });

  it('is deterministic for the same input', async () => {
    const a = await scoreFromCore(freeCheckerInput());
    const b = await scoreFromCore(freeCheckerInput());
    expect(b.ats_score_optimized).toBe(a.ats_score_optimized);
    expect(b.subscores).toEqual(a.subscores);
  });
});
