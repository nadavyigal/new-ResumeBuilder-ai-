/**
 * WP-64 — deterministic repair for the model naming the per-role bullet array
 * something other than `achievements`.
 *
 * The optimizer prompt specifies `achievements`. gpt-4o sometimes returns
 * `responsibilities` instead, with `achievements` present but empty. Every
 * consumer in the codebase reads `achievements` and skips on empty
 * (`DesignRenderer.tsx:525`, `ats-resume-template.tsx:118`,
 * `api/v1/optimizations/[id]/route.ts:60`, `lib/ats/integration.ts:102`), and
 * nothing anywhere reads a resume role's `responsibilities`. The role therefore
 * rendered with its title, company and dates and none of its content, and the
 * scorer graded the same empty key — on the 2026-07-29 live run that was 18
 * bullets discarded across 5 roles while the ATS score rose 38 -> 61.
 *
 * Measured at the time of the fix: 12 of 384 stored optimizations (3.1%),
 * earliest 2026-05-28.
 *
 * Same posture as `stripFabricatedMetrics`: the prompt is instructed correctly,
 * and the output is repaired deterministically anyway, because a prompt is not
 * an enforcement mechanism.
 *
 * The only import is type-only, so this module adds nothing at runtime and
 * cannot create a cycle with `./index` or drag anything across the
 * client/server bundle boundary — see the WP-58 lesson in tasks/progress.md.
 */

import type { OptimizedResume } from './index';

/**
 * Accepted names for the per-role bullet array, in priority order. The first
 * key present with at least one usable string wins.
 */
export const BULLET_KEY_ALIASES = [
  'achievements',
  'responsibilities',
  'bullets',
  'highlights',
  'accomplishments',
] as const;

type ExperienceRole = OptimizedResume['experience'][number];

/** Keeps non-blank strings only; trims. Anything else is dropped. */
function usableStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

/** Reads a possibly-absent key off a role without widening the public type. */
function readKey(role: ExperienceRole, key: string): unknown {
  return (role as unknown as Record<string, unknown>)[key];
}

/**
 * Returns a copy of `resume` in which every role's bullets live under
 * `achievements`, whichever key the model actually used.
 *
 * Non-destructive in both directions: a role that already has usable
 * `achievements` is never overwritten by an alias, and the original alias key
 * is left on the object so nothing downstream that happens to read it breaks.
 * Roles always come back with `achievements` as an array, never undefined.
 */
export function normalizeExperienceBullets(resume: OptimizedResume): OptimizedResume {
  const roles: ExperienceRole[] = Array.isArray(resume?.experience) ? resume.experience : [];

  const experience = roles.map((role) => {
    if (!role || typeof role !== 'object') {
      return { achievements: [] } as unknown as ExperienceRole;
    }

    let bullets: string[] = [];
    for (const key of BULLET_KEY_ALIASES) {
      const candidate = usableStrings(readKey(role, key));
      if (candidate.length > 0) {
        bullets = candidate;
        break;
      }
    }

    return { ...role, achievements: bullets };
  });

  return { ...resume, experience };
}

/** Total bullets across every role. Used by the preservation invariant. */
export function countBullets(resume: OptimizedResume | null | undefined): number {
  const roles: ExperienceRole[] = Array.isArray(resume?.experience) ? resume.experience : [];
  return roles.reduce((sum, role) => sum + usableStrings(role?.achievements).length, 0);
}
