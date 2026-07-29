/**
 * WP-64 — the preservation invariant.
 *
 * Content loss is invisible to the ATS score: the scorer reads the same
 * `achievements` key the renderer does, so an emptied resume scores on its
 * summary and skills alone and can come back *higher*. On the 2026-07-29 live
 * run it scored 61 against an original of 38 with every bullet gone. These
 * guards are the only thing in the pipeline that can see that.
 */

import { describe, it, expect } from '@jest/globals';
import {
  hasTotalBulletLoss,
  losesContentAgainst,
} from '@/lib/ai-optimizer/optimize-pipeline';

const role = (bullets: string[]) => ({
  title: 'Head of Product',
  company: 'Acme',
  location: 'Tel Aviv',
  startDate: 'Jan 2020',
  endDate: 'Present',
  achievements: bullets,
});

const resume = (roles: ReturnType<typeof role>[]) => ({ experience: roles }) as never;

describe('hasTotalBulletLoss', () => {
  it('flags the live WP-64 shape: roles present, every bullet gone', () => {
    expect(hasTotalBulletLoss(resume([role([]), role([]), role([]), role([]), role([])]))).toBe(true);
  });

  it('does not flag a healthy candidate', () => {
    expect(hasTotalBulletLoss(resume([role(['Led discovery']), role(['Shipped v2'])]))).toBe(false);
  });

  it('does not flag a resume with no roles at all — that is a different problem', () => {
    // A genuinely experience-free resume (new graduate) must not be rejected.
    expect(hasTotalBulletLoss(resume([]))).toBe(false);
  });

  it('flags a partially-empty resume only when nothing survives anywhere', () => {
    expect(hasTotalBulletLoss(resume([role([]), role(['One bullet left'])]))).toBe(false);
  });

  it('tolerates null and malformed input', () => {
    expect(hasTotalBulletLoss(null)).toBe(false);
    expect(hasTotalBulletLoss(undefined)).toBe(false);
    expect(hasTotalBulletLoss({} as never)).toBe(false);
  });
});

describe('losesContentAgainst', () => {
  it('rejects a pass 2 that dropped everything', () => {
    const before = resume([role(['a', 'b', 'c']), role(['d', 'e', 'f'])]);
    const after = resume([role([]), role([])]);
    expect(losesContentAgainst(after, before)).toBe(true);
  });

  it('rejects a pass 2 that lost more than a third of the evidence', () => {
    const before = resume([role(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])]); // 9
    const after = resume([role(['a', 'b', 'c', 'd', 'e'])]);                       // 5 < ceil(6)
    expect(losesContentAgainst(after, before)).toBe(true);
  });

  it('allows genuine consolidation', () => {
    const before = resume([role(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])]); // 9
    const after = resume([role(['a', 'b', 'c', 'd', 'e', 'f'])]);                 // 6 == ceil(6)
    expect(losesContentAgainst(after, before)).toBe(false);
  });

  it('allows a pass 2 that added content', () => {
    const before = resume([role(['a', 'b'])]);
    const after = resume([role(['a', 'b', 'c'])]);
    expect(losesContentAgainst(after, before)).toBe(false);
  });

  it('does not fire when pass 1 had nothing to lose', () => {
    // Avoids double-punishing a candidate already handled by hasTotalBulletLoss.
    expect(losesContentAgainst(resume([role([])]), resume([role([])]))).toBe(false);
  });

  it('treats a null pass 2 as a loss', () => {
    expect(losesContentAgainst(null, resume([role(['a', 'b', 'c'])]))).toBe(true);
  });
});
