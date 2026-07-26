/**
 * WP-45 S8 — the client must be able to tell a real improvement from a fake one
 *
 * The backend has known since S2 whether a run improved on the resume the user
 * started with. Until now nothing returned that to the client, so the app had
 * no way to avoid rendering "42 before, 44 after" — the exact pair the
 * moderated session hit. This pins the contract the UI depends on.
 */

import { assessLift, MIN_MEANINGFUL_LIFT } from '../lift';

describe('WP-45 S8: the lift contract a client can act on', () => {
  it('tells the client to withhold the pair for the case that started this', () => {
    const lift = assessLift({ original: 42, optimized: 44 });
    expect(lift.displayScores).toBe(false);
    expect(lift.delta).toBe(2);
  });

  it('tells the client to show the pair for a real improvement', () => {
    const lift = assessLift({ original: 33, optimized: 52 });
    expect(lift.displayScores).toBe(true);
  });

  it('reports the honest numbers even when withholding them', () => {
    // Withholding is a display decision. The scores themselves are never
    // rewritten, clamped or floored — a client that wants the raw values for
    // diagnostics still gets the truth.
    const lift = assessLift({ original: 60, optimized: 55 });
    expect(lift.original).toBe(60);
    expect(lift.optimized).toBe(55);
    expect(lift.delta).toBe(-5);
    expect(lift.displayScores).toBe(false);
  });

  it('exposes a stable floor rather than a per-call threshold', () => {
    // The floor is a named constant so it cannot be nudged per surface until
    // an embarrassing result becomes a passing one.
    expect(MIN_MEANINGFUL_LIFT).toBeGreaterThan(0);
    expect(assessLift({ original: 40, optimized: 40 + MIN_MEANINGFUL_LIFT }).displayScores).toBe(true);
    expect(assessLift({ original: 40, optimized: 39 + MIN_MEANINGFUL_LIFT }).displayScores).toBe(false);
  });
});
