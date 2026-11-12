/**
 * The optimizer model fills fields it cannot find with stand-ins such as
 * "Not specified", "N/A" or "Not provided". Saved as-is, they print in the
 * exported resume (beside a company, a university, in the header), and a user
 * can send that to an employer. An empty field renders as nothing, so every
 * stand-in becomes an empty string here.
 *
 * Kept narrow on purpose: only whole-value stand-ins match. "NA" and "N.A."
 * are region codes and stay; "Unknown Worlds" is a company and stays. A field
 * whose whole value is "Unknown" is cleared: printed on a resume it says nothing.
 */

const EXACT_PLACEHOLDERS = new Set([
  'not specified',
  'not provided',
  'not available',
  'not applicable',
  'not mentioned',
  'not stated',
  'not listed',
  'none provided',
  'unspecified',
  'unknown',
  'n/a',
  'לא צוין',
  'לא צויין',
  'לא צוינה',
  'לא צויינה',
  'לא ידוע',
  'לא ידועה',
  'לא זמין',
  'לא סופק',
  'לא רלוונטי',
]);

// "Location not specified", "Dates not provided": one or two words, then a stand-in.
const LABELLED_PLACEHOLDER =
  /^(?:\p{L}+ ){1,2}(?:not specified|not provided|not available|not mentioned|not stated|unspecified|unknown)$/u;

function normalizeForMatch(value: string): string {
  return value.trim().replace(/\.+$/, '').replace(/\s+/g, ' ').toLowerCase();
}

export function isPlaceholderValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeForMatch(value);
  if (!normalized) return false;
  return EXACT_PLACEHOLDERS.has(normalized) || LABELLED_PLACEHOLDER.test(normalized);
}

/**
 * Returns a copy with every stand-in string cleared: object fields become "",
 * array items are dropped. Numbers, booleans and real text are untouched.
 */
export function stripPlaceholderValues<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (typeof value === 'string') {
    return isPlaceholderValue(value) ? '' : value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => !isPlaceholderValue(item)).map(strip);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = strip(child);
    }
    return out;
  }
  return value;
}
