/**
 * Whether a session belongs to the team rather than to a real user.
 *
 * The web has never had this concept at any level. `identify` set only email,
 * full name, created_at and UTM params, so every founder and QA session has
 * counted as a real user in every activation number this product has reported.
 * iOS closed the same gap in 1.4.9 (21) with `resolveInternalTester`; this is
 * the web half, and it is deliberately the same contract so a cohort can be
 * filtered identically on both platforms.
 *
 * Configure with `NEXT_PUBLIC_INTERNAL_TESTER_EMAILS` (comma, space or newline
 * separated). It is a `NEXT_PUBLIC_` value because `identify` runs in the
 * browser, so the addresses are readable in the client bundle. That is the same
 * exposure iOS already accepts by shipping `INTERNAL_TESTER_EMAILS` inside the
 * app bundle, and these are team addresses, not secrets. Never put anything
 * here that is not already public.
 *
 * This flag cannot repair the past. PostHog's person-on-events snapshots
 * properties at ingest, so events recorded before this ships keep whatever they
 * had. It starts a clean boundary; it does not move the old one.
 */

/**
 * Lowercased and trimmed, with any `+suffix` removed from the local part.
 *
 * QA accounts here are created as plus aliases, so one configured address has to
 * cover every future `name+qa-whatever@…` without a redeploy. A list that named
 * each one would drift out of date the first time someone made another.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return null;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const base = local.split('+', 1)[0];
  if (!base) return null;

  return base + domain;
}

/** Parse a comma / space / newline separated allowlist into normalized addresses. */
export function parseInternalTesterEmails(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  const entries = raw
    .split(/[,\s]+/)
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry));
  return new Set(entries);
}

/**
 * Pure membership test. Fails closed towards "real user": an unconfigured or
 * empty allowlist returns false for everyone rather than true, because the
 * opposite would silently empty the activation cohort instead of merely
 * failing to clean it.
 */
export function isInternalTesterEmail(
  email: string | null | undefined,
  allowlist: Set<string>,
): boolean {
  if (allowlist.size === 0) return false;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return allowlist.has(normalized);
}

/** The configured allowlist, read once per module load. */
export function configuredInternalTesterEmails(): Set<string> {
  return parseInternalTesterEmails(process.env.NEXT_PUBLIC_INTERNAL_TESTER_EMAILS);
}

/** Convenience wrapper used by the `identify` call sites. */
export function resolveInternalTester(email: string | null | undefined): boolean {
  return isInternalTesterEmail(email, configuredInternalTesterEmails());
}
