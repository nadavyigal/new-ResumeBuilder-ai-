/**
 * WP-45 S9 — Score regime handling
 *
 * Scores from different regimes must never be silently blended. The scale moved
 * ~20 points on 2026-06-18 (monthly optimized mean 60.7 in May, 38.8 in June)
 * and again with the S1/S2 repairs.
 */

import {
  regimeFor,
  assertComparable,
  restrictToRegime,
  SCORE_REGIMES,
} from '../score-regime';
import { SCORE_VERSION } from '../core';

describe('WP-45 S9: identifying the regime that produced a score', () => {
  it('trusts the stamped version over the date', () => {
    // The stamp is written at scoring time and is authoritative; a backfilled
    // or re-dated row must not be able to lie about which engine scored it.
    expect(
      regimeFor({ scoredAt: '2026-01-01T00:00:00Z', scoreVersion: SCORE_VERSION })
    ).toBe(SCORE_REGIMES.wp45_repaired);
  });

  it('dates unstamped rows into the right regime', () => {
    expect(regimeFor({ scoredAt: '2026-05-15T00:00:00Z' })).toBe(SCORE_REGIMES.legacy_loose);
    expect(regimeFor({ scoredAt: '2026-06-25T00:00:00Z' })).toBe(
      SCORE_REGIMES.tightened_uncalibrated
    );
    expect(regimeFor({ scoredAt: '2026-07-25T00:00:00Z' })).toBe(SCORE_REGIMES.wp45_repaired);
  });

  it('puts the 2026-06-18 boundary on the tightened side', () => {
    expect(regimeFor({ scoredAt: '2026-06-18T00:00:00Z' })).toBe(
      SCORE_REGIMES.tightened_uncalibrated
    );
    expect(regimeFor({ scoredAt: '2026-06-17T23:59:59Z' })).toBe(SCORE_REGIMES.legacy_loose);
  });
});

describe('WP-45 S9: refusing to blend regimes', () => {
  it('flags a mixed set as not comparable', () => {
    // This is the May-plus-June average that reads as a 20-point collapse in
    // resume quality when nothing about the resumes changed.
    const verdict = assertComparable([
      { scoredAt: '2026-05-15T00:00:00Z' },
      { scoredAt: '2026-06-25T00:00:00Z' },
    ]);
    expect(verdict.comparable).toBe(false);
    expect(verdict.reason).toBe('mixed_regimes');
    expect(verdict.regimes).toHaveLength(2);
  });

  it('accepts a single-regime set', () => {
    const verdict = assertComparable([
      { scoredAt: '2026-06-20T00:00:00Z' },
      { scoredAt: '2026-07-01T00:00:00Z' },
    ]);
    expect(verdict.comparable).toBe(true);
  });

  it('accepts an empty set rather than throwing', () => {
    expect(assertComparable([]).comparable).toBe(true);
  });

  it('restricts a mixed set to one regime instead of averaging across', () => {
    const rows = [
      { scoredAt: '2026-05-15T00:00:00Z' },
      { scoredAt: '2026-06-25T00:00:00Z' },
      { scoredAt: '2026-07-25T00:00:00Z' },
    ];
    const restricted = restrictToRegime(rows);
    expect(restricted).toHaveLength(1);
    expect(assertComparable(restricted).comparable).toBe(true);
  });
});

describe('WP-45 S9: stored scores are not rewritten', () => {
  it('exposes no rescoring or mutation helper', async () => {
    // Rescoring stored rows is a production data change needing its own
    // decision: a user who already saw a number should not find it silently
    // different later. This module classifies; it never rewrites.
    const module = await import('../score-regime');
    const names = Object.keys(module).join(' ').toLowerCase();
    expect(names).not.toMatch(/rescore|backfill|migrate|update|write/);
  });
});
