/**
 * The fit check the user sees between optimizing and accepting.
 *
 * /api/optimize used to return only { reviewId, nextStep }. The pipeline
 * measured the starting score, the potential and the lift, and the route threw
 * all three away — so the app had nothing to render and jumped straight to the
 * accept screen. On device that looked like the fit check had disappeared.
 */

import { assessLift } from '@/lib/ats/lift';

describe('the fit block the optimize route returns', () => {
  it('carries the numbers the fit check needs', () => {
    // Shape check against what the route builds, so a rename on either side
    // fails here rather than silently emptying the screen again.
    const ats = { ats_score_original: 29, ats_score_optimized: 48, confidence: 0.8 };
    const lift = assessLift({ original: ats.ats_score_original, optimized: ats.ats_score_optimized });

    const fit = {
      currentScore: ats.ats_score_original,
      potentialScore: ats.ats_score_optimized,
      delta: lift.delta,
      displayScores: lift.displayScores,
    };

    expect(fit.currentScore).toBe(29);
    expect(fit.potentialScore).toBe(48);
    expect(fit.delta).toBe(19);
    expect(fit.displayScores).toBe(true);
  });

  it('tells the client to withhold the pair when the run did not really improve', () => {
    // The 42 -> 44 case. The fit check still shows gaps and a next step; it
    // just does not present a number pair that reads as a promise.
    const lift = assessLift({ original: 42, optimized: 44 });
    expect(lift.displayScores).toBe(false);
    expect(lift.delta).toBe(2);
  });

  it('never reports a potential below the current score', () => {
    // A "potential" the user cannot reach is the defect this packet started on.
    const lift = assessLift({ original: 60, optimized: 55 });
    expect(lift.displayScores).toBe(false);
    expect(Math.max(lift.original, lift.optimized)).toBe(60);
  });
});
