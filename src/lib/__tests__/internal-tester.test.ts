/**
 * The web has never had an `is_internal_tester` concept at any level. `identify`
 * set only email, full name, created_at and UTM params, so every founder and QA
 * session has counted as a real user in every activation number this product has
 * ever reported. iOS fixed the same gap in 1.4.9 (21); the web never had it.
 *
 * Mirrors the iOS contract deliberately, including `+alias` folding, so one
 * configured address covers every future `name+qa-whatever@…` without a redeploy
 * and so the two platforms can be filtered the same way.
 */
import {
  normalizeEmail,
  parseInternalTesterEmails,
  isInternalTesterEmail,
} from '../internal-tester';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Nadav.Yigal@Gmail.com ')).toBe('nadav.yigal@gmail.com');
  });

  it('folds a +alias into its base address', () => {
    // QA accounts here are created as plus aliases. A list naming each one drifts
    // out of date the first time someone makes another.
    expect(normalizeEmail('nadav.yigal+fable-qa-jul03@gmail.com')).toBe(
      'nadav.yigal@gmail.com',
    );
  });

  it('returns null for input that is not an address', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail('+only@gmail.com')).toBeNull();
  });
});

describe('parseInternalTesterEmails', () => {
  it('accepts comma, space and newline separated lists', () => {
    const parsed = parseInternalTesterEmails('a@x.com, b@x.com\nc@x.com d@x.com');
    expect(parsed).toEqual(new Set(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']));
  });

  it('normalizes entries so a configured alias still matches its base', () => {
    expect(parseInternalTesterEmails('Nadav.Yigal+qa@Gmail.com')).toEqual(
      new Set(['nadav.yigal@gmail.com']),
    );
  });

  it('is empty for empty or missing config', () => {
    expect(parseInternalTesterEmails('')).toEqual(new Set());
    expect(parseInternalTesterEmails(undefined)).toEqual(new Set());
  });
});

describe('isInternalTesterEmail', () => {
  const allowlist = parseInternalTesterEmails('nadav.yigal@gmail.com');

  it('matches the configured address', () => {
    expect(isInternalTesterEmail('nadav.yigal@gmail.com', allowlist)).toBe(true);
  });

  it('matches any +alias of the configured address without listing it', () => {
    expect(isInternalTesterEmail('nadav.yigal+wp49qa@gmail.com', allowlist)).toBe(true);
    expect(isInternalTesterEmail('nadav.yigal+anything-new@gmail.com', allowlist)).toBe(true);
  });

  it('does not match a real user', () => {
    expect(isInternalTesterEmail('yanivshm@gmail.com', allowlist)).toBe(false);
  });

  it('does not match on a shared local part at another domain', () => {
    expect(isInternalTesterEmail('nadav.yigal@example.com', allowlist)).toBe(false);
  });

  it('is false, never throws, for a missing address', () => {
    expect(isInternalTesterEmail(null, allowlist)).toBe(false);
    expect(isInternalTesterEmail(undefined, allowlist)).toBe(false);
  });

  it('is false when nothing is configured, rather than true for everyone', () => {
    // An empty allowlist must fail closed towards "real user". The opposite
    // would silently empty the activation cohort.
    expect(isInternalTesterEmail('nadav.yigal@gmail.com', new Set())).toBe(false);
  });
});
