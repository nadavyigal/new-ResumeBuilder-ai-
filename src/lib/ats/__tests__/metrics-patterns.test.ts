/** @jest-environment node */
/**
 * WP-59 S3d — what counts as a quantified achievement.
 *
 * The original five patterns required a `%`, a `$`, a `#`, an `x` or an
 * uppercase K/M/B. Every ordinary quantity an engineer writes counted as NO
 * metric, `metrics_presence` hard-clamps to 0 when nothing matches, and the
 * component forfeits its whole 11.4% weight. Across the 32-case benchmark it
 * meaned 5.3 out of 100 — on fixtures written to contain metrics.
 *
 * The line these tests defend: a number must be bound to a unit, a countable
 * noun, or an explicit before/after. A bare integer is still not a metric, so
 * dates and phone numbers stay out.
 */

import { METRICS_THRESHOLDS } from '../config/thresholds';

const isMetric = (text: string) =>
  METRICS_THRESHOLDS.metric_patterns.some((pattern) => pattern.test(text));

describe('counts real quantified achievements', () => {
  it.each([
    'reduced p99 latency from 800ms to 120ms',
    'led a team of 12 engineers',
    'served 3 million requests per day',
    'cut deploy time from 40 minutes to 6',
    'improved conversion by 25%',
    'saved $50,000 annually',
    'ranked #1 in the region',
    'grew throughput 3x',
    'migrated 2TB of data',
    'supported 15000 users',
  ])('%p counts', (text) => {
    expect(isMetric(text)).toBe(true);
  });
});

describe('does not count numbers that are not achievements', () => {
  it.each([
    'Software Engineer 2019 - 2023',
    '5 years of experience',
    'Tel Aviv, Israel',
    'B.Sc. Computer Science',
  ])('%p does not count', (text) => {
    expect(isMetric(text)).toBe(false);
  });
});
