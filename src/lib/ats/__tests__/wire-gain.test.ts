import { toWireGain } from '../wire-gain';
import { estimateImpact } from '../suggestions/impact-estimator';
import type { SubScoreKey } from '../types';

describe('toWireGain', () => {
  it('rounds the fractional gains estimateImpact actually produces', () => {
    expect(toWireGain(2.5)).toBe(3);
    expect(toWireGain(3.75)).toBe(4);
    expect(toWireGain(0.6)).toBe(1);
    expect(toWireGain(0.36)).toBe(0);
  });

  it('leaves whole numbers alone', () => {
    expect(toWireGain(6)).toBe(6);
    expect(toWireGain(0)).toBe(0);
  });

  it('returns null rather than NaN for absent or unusable values', () => {
    expect(toWireGain(undefined)).toBeNull();
    expect(toWireGain(null)).toBeNull();
    expect(toWireGain(Number.NaN)).toBeNull();
    expect(toWireGain(Number.POSITIVE_INFINITY)).toBeNull();
  });

  /**
   * The contract test that did not exist on 2026-08-28, which is why WP-59
   * shipped a payload no installed iOS build could decode. `estimateImpact` is
   * free to return one decimal; what crosses the wire must still be an integer.
   */
  it('makes every estimateImpact output safe for a client that decodes Int', () => {
    const subscores: SubScoreKey[] = ['keyword_exact', 'metrics_presence', 'format_parseability'];
    const templateGains = [4, 7, 9, 12, 15];
    const currentScores = [0, 17, 34, 51, 68, 93];

    const raw: number[] = [];
    for (const subscore of subscores) {
      for (const templateGain of templateGains) {
        for (const currentScore of currentScores) {
          raw.push(estimateImpact(subscore, currentScore, templateGain));
        }
      }
    }

    // Guard the guard: if these ever stop being fractional the risk is gone
    // and this test is no longer testing anything.
    expect(raw.some(value => !Number.isInteger(value))).toBe(true);

    for (const value of raw) {
      expect(Number.isInteger(toWireGain(value) as number)).toBe(true);
    }
  });
});
