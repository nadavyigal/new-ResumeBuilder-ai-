import { X509Certificate } from 'node:crypto';
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import { APPLE_ROOT_CA_G3_PEM } from '@/lib/apple-root-certificates';

/**
 * Apple In-App Purchase verification (StoreKit spec sections 4, 7 and 8,
 * docs/superpowers/specs/2026-10-15-resumely-storekit-export-credits-spec.md).
 *
 * Every transaction and notification is verified with Apple's own library
 * (F3): the signature chain to Apple Root CA G3, the bundle ID, the App Apple
 * ID and the environment. Nothing here trusts the request body for an amount.
 */

/** Section 4 (F4). Unknown IDs, including the old credits_* ones, grant nothing. */
export const EXPORT_PACKS: Readonly<Record<string, number>> = Object.freeze({
  'resumely.exports.1': 1,
  'resumely.exports.5': 5,
  'resumely.exports.10': 10,
});

export function creditsForProduct(productId: string): number {
  return Object.prototype.hasOwnProperty.call(EXPORT_PACKS, productId) ? EXPORT_PACKS[productId] : 0;
}

export type AppleEnvironment = 'Production' | 'Sandbox';

export interface AppleIapConfig {
  bundleId: string;
  /** Required when Production is allowed; Apple omits it in Sandbox. */
  appAppleId: number | null;
  allowedEnvironments: AppleEnvironment[];
}

/**
 * Section 7.3. Returns null when anything is missing or malformed, and the
 * routes answer 503 without granting (check 1).
 * `APPLE_IAP_ALLOWED_ENVIRONMENTS` is `Production,Sandbox` in production (F6)
 * and `Sandbox` in preview.
 */
export function getAppleIapConfig(
  env: Record<string, string | undefined> = process.env
): AppleIapConfig | null {
  const bundleId = env.APPLE_IAP_BUNDLE_ID?.trim();
  const allowedRaw = env.APPLE_IAP_ALLOWED_ENVIRONMENTS?.trim();
  if (!bundleId || !allowedRaw) return null;

  const tokens = allowedRaw.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0 || tokens.some((token) => token !== 'Production' && token !== 'Sandbox')) {
    return null;
  }
  const allowedEnvironments = Array.from(new Set(tokens)) as AppleEnvironment[];

  const appAppleIdRaw = env.APPLE_IAP_APP_APPLE_ID?.trim();
  let appAppleId: number | null = null;
  if (appAppleIdRaw) {
    if (!/^\d+$/.test(appAppleIdRaw)) return null;
    appAppleId = Number(appAppleIdRaw);
  }
  if (allowedEnvironments.includes('Production') && appAppleId === null) return null;

  return { bundleId, appAppleId, allowedEnvironments };
}

let rootCertificates: Buffer[] | null = null;
const verifiers = new Map<string, SignedDataVerifier>();

function getVerifier(config: AppleIapConfig, environment: AppleEnvironment): SignedDataVerifier {
  const key = `${environment}|${config.bundleId}|${config.appAppleId ?? ''}`;
  let verifier = verifiers.get(key);
  if (!verifier) {
    rootCertificates ??= [new X509Certificate(APPLE_ROOT_CA_G3_PEM).raw];
    verifier = new SignedDataVerifier(
      rootCertificates,
      true, // online checks: certificate revocation and expiry against today's date
      environment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX,
      config.bundleId,
      environment === 'Production' ? config.appAppleId ?? undefined : undefined
    );
    verifiers.set(key, verifier);
  }
  return verifier;
}

/**
 * Reads the claimed environment from a JWS payload **without** verifying it,
 * only to pick which verifier to run. The verifier then checks the signature
 * and that the environment matches, so a lie here fails verification.
 */
function claimedEnvironment(jws: string, kind: 'transaction' | 'notification'): string | null {
  const parts = jws.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Notifications carry it in data, in summary for summary-type notifications,
    // or in appData (for example RESCIND_CONSENT).
    const value = kind === 'transaction'
      ? payload?.environment
      : payload?.data?.environment ?? payload?.summary?.environment ?? payload?.appData?.environment;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export type AppleVerifyFailure = {
  ok: false;
  /** Section 7.2 codes; `verification_unavailable` is Apple's retryable failure (OCSP, network). */
  reason: 'invalid_transaction' | 'environment_not_allowed' | 'verification_unavailable';
};

async function verifyWith<T>(
  jws: string,
  kind: 'transaction' | 'notification',
  config: AppleIapConfig,
  decode: (verifier: SignedDataVerifier) => Promise<T>
): Promise<{ ok: true; value: T; environment: AppleEnvironment } | AppleVerifyFailure> {
  const environment = claimedEnvironment(jws, kind);
  if (environment === null) return { ok: false, reason: 'invalid_transaction' };
  if (!config.allowedEnvironments.includes(environment as AppleEnvironment)) {
    return { ok: false, reason: 'environment_not_allowed' };
  }
  try {
    const value = await decode(getVerifier(config, environment as AppleEnvironment));
    return { ok: true, value, environment: environment as AppleEnvironment };
  } catch (error) {
    if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) {
      return { ok: false, reason: 'verification_unavailable' };
    }
    return { ok: false, reason: 'invalid_transaction' };
  }
}

/** Section 7.2 checks 3 and 4 for a StoreKit 2 `jwsRepresentation`. */
export function verifySignedTransaction(signedTransaction: string, config: AppleIapConfig) {
  return verifyWith<JWSTransactionDecodedPayload>(signedTransaction, 'transaction', config, (verifier) =>
    verifier.verifyAndDecodeTransaction(signedTransaction)
  );
}

/** Section 8: an App Store Server Notification V2 `signedPayload`. */
export function verifySignedNotification(signedPayload: string, config: AppleIapConfig) {
  return verifyWith<ResponseBodyV2DecodedPayload>(signedPayload, 'notification', config, (verifier) =>
    verifier.verifyAndDecodeNotification(signedPayload)
  );
}
