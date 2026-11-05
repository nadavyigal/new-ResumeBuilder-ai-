import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { EXPORT_PACKS, RETIRED_PACK_IDS, SUBSCRIPTION_PRODUCTS } from '@/lib/iap';

/**
 * The Terms and Privacy pages are read by App Review and by buyers. They must
 * describe how Resumely really charges: Apple In-App Purchase in the iOS app,
 * pricing v2 (ResumeBuilder-IOS-APP plans/resumely-pricing-v2.md and its
 * Resumely.storekit). Web checkout is not live, so neither Stripe nor Paddle
 * may appear, and the retired $9/month Premium plan must not come back.
 */

type Messages = Record<string, unknown>;

const LOCALES = ['en', 'he'] as const;

function readMessages(locale: string): Messages {
  const file = path.join(process.cwd(), 'src/messages', `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Messages;
}

function flatten(value: unknown): string {
  return JSON.stringify(value);
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Messages).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe('legal pages billing copy', () => {
  it('pricing v2 sells two packs and one subscription', () => {
    const onSale = Object.keys(EXPORT_PACKS).filter((id) => !RETIRED_PACK_IDS.includes(id));
    expect(onSale.sort()).toEqual(['resumely.exports.14', 'resumely.exports.5.v2']);
    expect(EXPORT_PACKS['resumely.exports.5.v2']).toBe(5);
    expect(EXPORT_PACKS['resumely.exports.14']).toBe(14);
    expect(SUBSCRIPTION_PRODUCTS).toEqual(['resumely.pro.monthly']);
  });

  for (const locale of LOCALES) {
    describe(locale, () => {
      const messages = readMessages(locale);
      const terms = flatten(messages.terms);
      const privacy = flatten(messages.privacy);

      it('names no web payment processor and no retired plan', () => {
        for (const text of [terms, privacy]) {
          expect(text).not.toMatch(/stripe/i);
          expect(text).not.toMatch(/paddle/i);
          // The retired plan: "$9/month" and "9$ לחודש" (not the 9.99$ Pro price).
          expect(text).not.toMatch(/\$9\/month|(?<![\d.])9\$ לחודש/);
        }
      });

      it('states Apple billing and the pricing v2 prices', () => {
        expect(terms).toContain('Apple');
        expect(terms).toContain('3.99');
        expect(terms).toContain('7.99');
        expect(terms).toContain('9.99');
        expect(terms).toContain('reportaproblem.apple.com');
        expect(terms).toContain('stdeula');
        expect(privacy).toContain('https://www.apple.com/legal/privacy/');
      });
    });
  }

  it('Hebrew terms and privacy have the same keys as English', () => {
    const en = readMessages('en');
    const he = readMessages('he');
    expect(leafPaths(he.terms)).toEqual(leafPaths(en.terms));
    expect(leafPaths(he.privacy)).toEqual(leafPaths(en.privacy));
  });
});
