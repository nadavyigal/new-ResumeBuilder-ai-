/**
 * WP-59 S1 — a suggestion may not promise more than applying it can deliver.
 *
 * The defect these tests pin: `estimateImpact` multiplied `subscoreGap × weight`
 * — already a final-score number — by 100, then clamped to 15. Every real value
 * is under 4, so the clamp caught all of them and every suggestion in the
 * product displayed exactly 15. Three of them read "+15 / +15 / +15" beside an
 * apply that could move the score by seven.
 *
 * The property worth defending is not a particular number. It is that the sum
 * of what we promise stays inside the score's remaining headroom, and that no
 * single suggestion promises more than its component's weight can pay.
 */

import { estimateImpact, estimateTotalImpact } from '../impact-estimator';
import { SUB_SCORE_WEIGHTS } from '../../config/weights';
import { SUGGESTION_THRESHOLDS } from '../../config/thresholds';
import type { SubScoreKey } from '../../types';

const WEIGHTED_KEYS = (Object.keys(SUB_SCORE_WEIGHTS) as SubScoreKey[]).filter(
  key => SUB_SCORE_WEIGHTS[key] > 0
);

describe('estimateImpact units', () => {
  it('returns final-score points, not sub-score points', () => {
    // 20 sub-score points on a component weighted 25% is worth 5 points of the
    // composite. Not 500, and not a clamped 15.
    expect(estimateImpact('keyword_exact', 45, 20)).toBeCloseTo(5, 5);
  });

  it('never exceeds the component weight times the room it has left', () => {
    for (const key of WEIGHTED_KEYS) {
      for (const currentScore of [0, 25, 50, 75, 90, 100]) {
        for (const templateGain of [4, 8, 12, 15]) {
          const gain = estimateImpact(key, currentScore, templateGain);
          const ceiling = (100 - currentScore) * SUB_SCORE_WEIGHTS[key];
          expect(gain).toBeLessThanOrEqual(ceiling + 0.05);
        }
      }
    }
  });

  it('does not pin every suggestion to one value', () => {
    // The symptom that made the 100x error invisible: the clamp collapsed the
    // whole range onto a single number. If this ever goes back to 1, the
    // estimator has stopped estimating.
    const distinct = new Set(
      WEIGHTED_KEYS.map(key => estimateImpact(key, 40, 12))
    );
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('promises nothing on a component with no room left', () => {
    expect(estimateImpact('keyword_exact', 100, 15)).toBe(0);
  });

  it('stays above the display floor for a genuinely worthwhile fix', () => {
    // Guards the other direction: if the thresholds and the estimator ever drift
    // apart again, the highest-weight component's advice would be filtered out
    // of the product entirely and nobody would see a suggestions list.
    const bestCase = estimateImpact('keyword_exact', 30, 15);
    expect(bestCase).toBeGreaterThanOrEqual(SUGGESTION_THRESHOLDS.min_gain);
  });
});

describe('estimateTotalImpact', () => {
  it('cannot promise more than the score has headroom for', () => {
    const suggestions = Array.from({ length: 10 }, () => ({ estimated_gain: 3.5 }));
    expect(estimateTotalImpact(suggestions, 80)).toBeLessThanOrEqual(20);
  });

  it('sums honestly when there is room', () => {
    expect(estimateTotalImpact([{ estimated_gain: 2.5 }, { estimated_gain: 1.5 }], 50)).toBeCloseTo(4, 5);
  });

  it('a full suggestion set cannot claim the old flat 30', () => {
    // One maximum-strength suggestion on every weighted component at once —
    // the most the estimator can ever promise. The weights sum to 1, so the
    // honest total converges on the template gain itself (~15), give or take
    // per-suggestion rounding. The previous implementation advertised 30 as a
    // "realistic maximum"; the real one is half that, and only when every
    // component simultaneously has room for a 15-point repair.
    const suggestions = WEIGHTED_KEYS.map(key => ({
      estimated_gain: estimateImpact(key, 50, 15),
    }));
    const total = estimateTotalImpact(suggestions, 50);
    expect(total).toBeGreaterThan(10);
    expect(total).toBeLessThan(30);
  });
});
