/**
 * Campaign context — carries a campaign identity from a public link to the
 * App Store handoff.
 *
 * THE GAP THIS CLOSES, AND THE ONE IT DOES NOT
 * --------------------------------------------
 * Resumely's governed activation funnel is iOS-only: `resume_file_selected`,
 * `optimization_started` and `optimization_completed` are emitted by the Swift
 * client (`$lib = resumely-ios-urlsession`) and scoped by exact app_version and
 * build_number in `scripts/measurement_contract.py`. `resume_file_selected`
 * does not exist in this repository at all.
 *
 * A campaign link therefore lands on the web, and the next hop is the App
 * Store, which does not forward query parameters into the installed app. So the
 * web session and the app session are two different identities with nothing
 * joining them.
 *
 * This module does the part that is honestly achievable without an attribution
 * vendor or an iOS change:
 *
 *   1. It reads the campaign identity from the landing URL and keeps it.
 *   2. It stamps that identity onto Apple's `ct` campaign token, so the install
 *      side of the hop is separable in App Store Connect's own reporting.
 *   3. It records a `campaign_store_handoff` event, so the number of people a
 *      campaign pushed at the store is a measured quantity rather than a guess.
 *
 * What it does NOT do: join a web arrival to an in-app activation. That join
 * needs Apple's attribution APIs or a deferred-deep-link vendor, and neither is
 * in scope. Until then, a campaign's arrival evidence stops at the store click
 * and the activation read stays a whole-cohort read. Say so in the readout
 * rather than implying the two are linked.
 *
 * Nothing here touches a governed event. `campaign_store_handoff` is a new,
 * web-only name; the three governed events are not read, written, or renamed.
 */

/** The live iOS listing. Kept here so the campaign token has one place to go. */
export const APP_STORE_BASE_URL =
  'https://apps.apple.com/app/resume-ai-cv-builder/id6776752349';

/** Preserved from the previous hard-coded link so organic behaviour is unchanged. */
export const DEFAULT_STORE_CAMPAIGN_TOKEN = 'web-ats';
export const STORE_PROVIDER_TOKEN = 'organic';

/** Non-governed. Web-only. Never used as an activation step. */
export const CAMPAIGN_HANDOFF_EVENT = 'campaign_store_handoff';

export const CAMPAIGN_STORAGE_KEY = 'resumely_campaign_context';

export interface CampaignContext {
  campaign_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  landed_at: string;
}

/**
 * One spelling for the campaign id everywhere: lowercase ASCII, hyphenated.
 * Mirrors `sanitizeCampaignToken` in `docs/gtm/growth-loop/loop-card.logic.js`
 * so a card-generated id and a stored token are the same string by eye. The two
 * are covered by the same test vectors; change both or neither.
 */
export function sanitizeCampaignToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * `utm_campaign` is the campaign id; `campaign_id` is accepted as an explicit
 * alias for channels where a UTM set would be stripped. A link with neither
 * carries no campaign and must not be given one by default — an invented
 * campaign id is worse than none, because it looks like evidence.
 */
export function readCampaignFromSearch(
  search: string,
  nowIso?: string,
): CampaignContext | null {
  const params = new URLSearchParams(search || '');
  const raw = params.get('utm_campaign') || params.get('campaign_id');
  const campaignId = sanitizeCampaignToken(raw);
  if (!campaignId) return null;

  return {
    campaign_id: campaignId,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_content: params.get('utm_content'),
    landed_at: nowIso ?? new Date().toISOString(),
  };
}

/**
 * The App Store URL for a given campaign. With no campaign the URL is byte-for-
 * byte what the page served before this module existed, so the organic path has
 * no behaviour change to roll back.
 */
export function buildAppStoreUrl(campaignId?: string | null): string {
  const token = sanitizeCampaignToken(campaignId) || DEFAULT_STORE_CAMPAIGN_TOKEN;
  return `${APP_STORE_BASE_URL}?ct=${encodeURIComponent(token)}&at=${STORE_PROVIDER_TOKEN}`;
}

/** Storage is best-effort: private windows and blocked site data must not throw. */
export function persistCampaign(context: CampaignContext): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(context));
  } catch {
    /* storage unavailable — the campaign is still usable for this page view */
  }
}

export function loadCampaign(): CampaignContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignContext>;
    const campaignId = sanitizeCampaignToken(parsed?.campaign_id);
    if (!campaignId) return null;
    return {
      campaign_id: campaignId,
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_content: parsed.utm_content ?? null,
      landed_at: parsed.landed_at ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * First visit wins. A user who arrives on a campaign link and later navigates
 * in without one keeps the campaign that brought them; a second campaign link
 * replaces it, because that arrival is the more recent cause.
 */
export function resolveCampaign(
  search: string,
  nowIso?: string,
): CampaignContext | null {
  const fromUrl = readCampaignFromSearch(search, nowIso);
  if (fromUrl) {
    persistCampaign(fromUrl);
    return fromUrl;
  }
  return loadCampaign();
}

/** The properties attached to the handoff event. PII-free by construction. */
export function handoffProperties(
  context: CampaignContext | null,
  locale: string,
): Record<string, string | null> {
  return {
    campaign_id: context?.campaign_id ?? null,
    utm_source: context?.utm_source ?? null,
    utm_medium: context?.utm_medium ?? null,
    utm_content: context?.utm_content ?? null,
    locale,
    destination: 'app_store',
    store_campaign_token: sanitizeCampaignToken(context?.campaign_id) || DEFAULT_STORE_CAMPAIGN_TOKEN,
  };
}
