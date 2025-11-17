import { describe, it, expect } from '@jest/globals';
import { calculateMatchScore } from '../ai-optimizer';

describe('calculateMatchScore', () => {
  it('returns 0 when the job description is empty', () => {
    expect(calculateMatchScore('experience text', '')).toBe(0);
  });

  it('returns 0 when the job description has no usable keywords', () => {
    const score = calculateMatchScore('full stack engineer', 'and or but if so');
    expect(score).toBe(0);
  });

  it('clamps the score between 0 and 100', () => {
    const resume = 'React Node.js leadership communication strategy';
    const job = 'React developer with strong leadership skills';
    const score = calculateMatchScore(resume, job);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
