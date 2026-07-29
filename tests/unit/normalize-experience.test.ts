/**
 * WP-64 — the optimizer silently deleted every experience bullet whenever the
 * model named the per-role array `responsibilities` instead of `achievements`.
 *
 * Every consumer (DesignRenderer, the ATS template, the optimizations API and
 * the scorer) reads `achievements` and skips on empty, so 18 real bullets were
 * discarded on a live 2026-07-29 run while the ATS score rose 38 -> 61.
 *
 * These tests pin the deterministic normalizer that fixes it. No OpenAI, no
 * network — the function is pure.
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeExperienceBullets,
  countBullets,
  BULLET_KEY_ALIASES,
} from '@/lib/ai-optimizer/normalize-experience';

describe('normalizeExperienceBullets', () => {
  it('promotes `responsibilities` into `achievements` when achievements is empty — the live WP-64 failure', () => {
    const raw = {
      experience: [
        {
          title: 'Head of Product',
          company: 'Acme',
          achievements: [],
          responsibilities: ['Led discovery', 'Shipped v2', 'Grew the team'],
        },
      ],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.experience[0].achievements).toEqual([
      'Led discovery',
      'Shipped v2',
      'Grew the team',
    ]);
    expect(countBullets(out)).toBe(3);
  });

  it('reproduces the founder run: 5 roles, 18 bullets, all recovered', () => {
    const raw = {
      experience: [3, 4, 4, 4, 3].map((n, r) => ({
        title: `Role ${r}`,
        company: `Company ${r}`,
        achievements: [],
        responsibilities: Array.from({ length: n }, (_, i) => `bullet ${r}.${i}`),
      })),
    };

    expect(countBullets(raw as never)).toBe(0);
    const out = normalizeExperienceBullets(raw as never);
    expect(countBullets(out)).toBe(18);
    expect(out.experience).toHaveLength(5);
  });

  it('leaves a correct response untouched — the 372 of 384 rows that were fine', () => {
    const raw = {
      experience: [
        { title: 'Engineer', company: 'Acme', achievements: ['Built the thing'] },
      ],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.experience[0].achievements).toEqual(['Built the thing']);
  });

  it('never lets an alias overwrite non-empty achievements', () => {
    const raw = {
      experience: [
        {
          title: 'Engineer',
          company: 'Acme',
          achievements: ['The real bullet'],
          responsibilities: ['A duplicate the model also emitted'],
        },
      ],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.experience[0].achievements).toEqual(['The real bullet']);
  });

  it('accepts every documented alias', () => {
    for (const alias of BULLET_KEY_ALIASES) {
      const raw = {
        experience: [{ title: 'T', company: 'C', [alias]: [`from ${alias}`] }],
      };
      const out = normalizeExperienceBullets(raw as never);
      expect(out.experience[0].achievements).toEqual([`from ${alias}`]);
    }
  });

  it('prefers the earlier alias when the model emits two of them', () => {
    // BULLET_KEY_ALIASES is ordered; `achievements` wins, then the rest in order.
    const raw = {
      experience: [{ title: 'T', company: 'C', responsibilities: ['resp'], bullets: ['bul'] }],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.experience[0].achievements).toEqual(['resp']);
  });

  it('drops blank and non-string entries rather than rendering empty bullets', () => {
    const raw = {
      experience: [
        {
          title: 'Engineer',
          company: 'Acme',
          responsibilities: ['  real  ', '', '   ', null, 42, 'also real'] as never,
        },
      ],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.experience[0].achievements).toEqual(['real', 'also real']);
  });

  it('always leaves achievements as an array, even when the model sends nothing', () => {
    const raw = { experience: [{ title: 'T', company: 'C' }] };

    const out = normalizeExperienceBullets(raw as never);

    expect(Array.isArray(out.experience[0].achievements)).toBe(true);
    expect(out.experience[0].achievements).toEqual([]);
  });

  it('tolerates a missing or non-array experience section without throwing', () => {
    expect(() => normalizeExperienceBullets({} as never)).not.toThrow();
    expect(normalizeExperienceBullets({} as never).experience).toEqual([]);
    expect(normalizeExperienceBullets({ experience: null } as never).experience).toEqual([]);
  });

  it('does not mutate its input', () => {
    const raw = {
      experience: [{ title: 'T', company: 'C', achievements: [], responsibilities: ['a'] }],
    };

    normalizeExperienceBullets(raw as never);

    expect(raw.experience[0].achievements).toEqual([]);
  });

  it('preserves every other field on the role and on the resume', () => {
    const raw = {
      summary: 'A summary',
      matchScore: 61,
      experience: [
        {
          title: 'Head of Product',
          company: 'Acme',
          location: 'Tel Aviv',
          startDate: 'Jan 2020',
          endDate: 'Present',
          responsibilities: ['Led discovery'],
        },
      ],
    };

    const out = normalizeExperienceBullets(raw as never);

    expect(out.summary).toBe('A summary');
    expect(out.matchScore).toBe(61);
    expect(out.experience[0]).toMatchObject({
      title: 'Head of Product',
      company: 'Acme',
      location: 'Tel Aviv',
      startDate: 'Jan 2020',
      endDate: 'Present',
    });
  });
});

describe('countBullets', () => {
  it('counts across roles and tolerates missing sections', () => {
    expect(countBullets({ experience: [{ achievements: ['a', 'b'] }, { achievements: ['c'] }] } as never)).toBe(3);
    expect(countBullets({} as never)).toBe(0);
    expect(countBullets({ experience: [] } as never)).toBe(0);
  });
});
