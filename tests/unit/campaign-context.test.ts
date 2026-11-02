/**
 * Campaign propagation: link -> stored context -> App Store `ct` token.
 *
 * The rollback case is a test rather than a note: with no campaign and no
 * provider token the store URL must be byte-for-byte the string this page
 * served before the change, so unsetting the token is provably a clean rollback.
 */
import {
  APP_STORE_BASE_URL,
  CAMPAIGN_STORAGE_KEY,
  DEFAULT_STORE_CAMPAIGN_TOKEN,
  STORE_CAMPAIGN_TOKEN_MAX_LENGTH,
  buildAppStoreUrl,
  validateStoreCampaignRegistry,
  handoffProperties,
  loadCampaign,
  readCampaignFromSearch,
  resolveCampaign,
  sanitizeCampaignToken,
  storeCampaignToken,
} from '@/lib/campaign-context';

const cardLogic = require('../../docs/gtm/growth-loop/loop-card.logic.js');

/** The exact URL the page hard-coded before campaign context existed. */
const PRE_CHANGE_URL =
  'https://apps.apple.com/app/resume-ai-cv-builder/id6776752349?ct=web-ats&at=organic';

const ORIGINAL_PROVIDER_TOKEN = process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN;

beforeEach(() => {
  window.localStorage.clear();
  delete process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN;
});

afterAll(() => {
  if (ORIGINAL_PROVIDER_TOKEN === undefined) {
    delete process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN;
  } else {
    process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = ORIGINAL_PROVIDER_TOKEN;
  }
});

describe('campaign id spelling', () => {
  const vectors: Array<[string, string]> = [
    ['rb-li-20260910-trusted-workspace', 'rb-li-20260910-trusted-workspace'],
    ['RB LinkedIn Trusted Workspace', 'rb-linkedin-trusted-workspace'],
    ['  --week1_launch--  ', 'week1-launch'],
    ['קמפיין', ''],
    ['', ''],
  ];

  test.each(vectors)('sanitises %p to %p', (input, expected) => {
    expect(sanitizeCampaignToken(input)).toBe(expected);
  });

  test('the card and the app agree on every vector', () => {
    vectors.forEach(([input, expected]) => {
      expect(cardLogic.sanitizeCampaignToken(input)).toBe(expected);
    });
  });

  test('is capped so an over-long id cannot break the store token', () => {
    expect(sanitizeCampaignToken('a'.repeat(200))).toHaveLength(64);
  });
});

describe('reading a campaign from the landing URL', () => {
  test('utm_campaign carries the campaign id and its companions', () => {
    const context = readCampaignFromSearch(
      '?utm_source=linkedin&utm_medium=social&utm_campaign=rb-li-20260910-trusted-workspace&utm_content=he_li_02',
      '2026-09-10T09:00:00Z',
    );
    expect(context).toEqual({
      campaign_id: 'rb-li-20260910-trusted-workspace',
      utm_source: 'linkedin',
      utm_medium: 'social',
      utm_content: 'he_li_02',
      landed_at: '2026-09-10T09:00:00Z',
    });
  });

  test('campaign_id is accepted where a UTM set would be stripped', () => {
    expect(readCampaignFromSearch('?campaign_id=rb-li-20260910')?.campaign_id).toBe(
      'rb-li-20260910',
    );
  });

  test('a link with no campaign is given none — an invented id would read as evidence', () => {
    expect(readCampaignFromSearch('?utm_source=linkedin')).toBeNull();
    expect(readCampaignFromSearch('')).toBeNull();
  });
});

describe('persistence across the visit', () => {
  test('a campaign survives a later navigation that carries no parameters', () => {
    resolveCampaign('?utm_campaign=rb-li-20260910-trusted-workspace', '2026-09-10T09:00:00Z');
    expect(resolveCampaign('')?.campaign_id).toBe('rb-li-20260910-trusted-workspace');
  });

  test('a second campaign link replaces the first', () => {
    resolveCampaign('?utm_campaign=first-campaign');
    expect(resolveCampaign('?utm_campaign=second-campaign')?.campaign_id).toBe('second-campaign');
  });

  test('corrupt stored data is discarded, not thrown', () => {
    window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, '{not json');
    expect(loadCampaign()).toBeNull();
    expect(resolveCampaign('')).toBeNull();
  });
});

describe('App Store handoff', () => {
  const LONG_CAMPAIGN = 'rb-li-20260910-trusted-workspace';
  const LONG_CAMPAIGN_STORE_TOKEN = 'rb-li-20260910-truste-1114aa54';

  test('a campaign becomes Apple’s ct token', () => {
    expect(buildAppStoreUrl('rb-li-20260910-he')).toBe(
      `${APP_STORE_BASE_URL}?ct=rb-li-20260910-he&at=organic`,
    );
  });

  test.each([29, 30, 31, 64])('bounds a %i-character ID without changing short IDs', (length) => {
    const id = 'a'.repeat(length);
    const token = storeCampaignToken(id);
    expect(token.length).toBeLessThanOrEqual(30);
    expect(token).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (length <= 30) expect(token).toBe(id);
    else expect(token).toMatch(/^a+-[a-f0-9]{8}$/);
  });

  test('distinguishes the reviewed long IDs with an identical 30-character prefix', () => {
    const a = 'rb-li-20260910-trusted-workspace-a';
    const b = 'rb-li-20260910-trusted-workspace-b';
    expect(storeCampaignToken(a)).not.toBe(storeCampaignToken(b));
    expect(storeCampaignToken(a)).toBe(storeCampaignToken(a));
    expect(STORE_CAMPAIGN_TOKEN_MAX_LENGTH).toBe(30);
  });

  test.each([undefined, '', '123456'])('URL/event equality including long-ID migration, provider=%p', (provider) => {
    if (provider === undefined) delete process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN;
    else process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = provider;
    for (const id of [null, 'a'.repeat(30), 'a'.repeat(31), 'a'.repeat(64), 'a'.repeat(29) + '-bbb']) {
      const context = id ? readCampaignFromSearch('?utm_campaign=' + id) : null;
      const ct = new URL(buildAppStoreUrl(id)).searchParams.get('ct');
      expect(ct).toBe(handoffProperties(context, 'he').store_campaign_token);
      expect(ct!.length).toBeLessThanOrEqual(30);
    }
  });

  test('publication preflight rejects sanitization, truncation and reserved-token collisions', () => {
    expect(validateStoreCampaignRegistry(['launch-a', 'launch-b'])).toHaveLength(2);
    expect(() => validateStoreCampaignRegistry(['launch a', 'launch-a'])).toThrow(/canonical/i);
    expect(() => validateStoreCampaignRegistry(['a'.repeat(65)])).toThrow(/canonical/i);
    expect(() => validateStoreCampaignRegistry(['web-ats'])).toThrow(/reserved/i);
    expect(() => validateStoreCampaignRegistry(['launch-a', 'launch-a'])).toThrow(/collision/i);
    expect(() => validateStoreCampaignRegistry([])).toThrow(/empty/i);
    expect(() => validateStoreCampaignRegistry(['קמפיין'])).toThrow(/canonical/i);
  });

  test('publication preflight rejects even a short ID equal to a derived long token', () => {
    const id = 'rb-li-20260910-trusted-workspace-a';
    expect(() => validateStoreCampaignRegistry([id, storeCampaignToken(id)])).toThrow(/collision/i);
  });

  describe('with a provider token configured', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = '123456';
    });

    test('a campaign link uses Apple’s pt, ct and mt format', () => {
      expect(buildAppStoreUrl('rb-li-20260910-he')).toBe(
        `${APP_STORE_BASE_URL}?pt=123456&ct=rb-li-20260910-he&mt=8`,
      );
    });

    test('an organic visit records under the default web token', () => {
      expect(buildAppStoreUrl(null)).toBe(
        `${APP_STORE_BASE_URL}?pt=123456&ct=${DEFAULT_STORE_CAMPAIGN_TOKEN}&mt=8`,
      );
    });

    test('the old at parameter is gone', () => {
      expect(new URL(buildAppStoreUrl('rb-li-20260910-he')).searchParams.has('at')).toBe(false);
    });

    test('stray whitespace in the configured token does not reach the link', () => {
      process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = ' 123456\n';
      expect(new URL(buildAppStoreUrl(null)).searchParams.get('pt')).toBe('123456');
    });

    test('the event reports the token the link actually carries', () => {
      const context = readCampaignFromSearch(`?utm_campaign=${LONG_CAMPAIGN}`);
      expect(handoffProperties(context, 'he').store_campaign_token).toBe(
        new URL(buildAppStoreUrl(context?.campaign_id)).searchParams.get('ct'),
      );
    });
  });

  test('a blank provider token falls back to the link served today', () => {
    process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = '   ';
    expect(buildAppStoreUrl(null)).toBe(PRE_CHANGE_URL);
  });

  test('ROLLBACK: with no campaign and no provider token the URL is unchanged', () => {
    expect(buildAppStoreUrl(null)).toBe(PRE_CHANGE_URL);
    expect(buildAppStoreUrl(undefined)).toBe(PRE_CHANGE_URL);
    expect(buildAppStoreUrl('')).toBe(PRE_CHANGE_URL);
    expect(PRE_CHANGE_URL).toContain(DEFAULT_STORE_CAMPAIGN_TOKEN);
  });

  test('handoff properties are PII-free and name the destination', () => {
    const context = readCampaignFromSearch(
      '?utm_source=linkedin&utm_medium=social&utm_campaign=rb-li-20260910-trusted-workspace',
      '2026-09-10T09:00:00Z',
    );
    expect(handoffProperties(context, 'he')).toEqual({
      campaign_id: 'rb-li-20260910-trusted-workspace',
      utm_source: 'linkedin',
      utm_medium: 'social',
      utm_content: null,
      locale: 'he',
      destination: 'app_store',
      store_campaign_token: LONG_CAMPAIGN_STORE_TOKEN,
    });
  });

  test('an organic visitor still produces a usable, campaign-free record', () => {
    expect(handoffProperties(null, 'en')).toMatchObject({
      campaign_id: null,
      store_campaign_token: DEFAULT_STORE_CAMPAIGN_TOKEN,
      destination: 'app_store',
    });
  });
});
