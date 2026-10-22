import { describe, expect, it } from '@jest/globals';
import { X509Certificate, generateKeyPairSync, sign } from 'node:crypto';
import {
  EXPORT_PACKS,
  creditsForProduct,
  getAppleIapConfig,
  verifySignedNotification,
  verifySignedTransaction,
  type AppleIapConfig,
} from '@/lib/iap';
import { APPLE_ROOT_CA_G3_PEM, APPLE_ROOT_CA_G3_SHA256 } from '@/lib/apple-root-certificates';

// StoreKit spec sections 4 and 7. These tests run Apple's real verifier
// (no mocks): anything not signed by Apple's chain must never verify.

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A JWS shaped like Apple's, signed by a key Apple never issued. */
function forgedJws(payload: Record<string, unknown>) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const fakeCert = Buffer.from('not-a-certificate').toString('base64');
  const header = b64url({ alg: 'ES256', x5c: [fakeCert, fakeCert, fakeCert] });
  const body = b64url(payload);
  const signature = sign('sha256', Buffer.from(`${header}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${body}.${signature.toString('base64url')}`;
}

const sandboxOnly: AppleIapConfig = {
  bundleId: 'Resumebuilder-IOS.ResumeBuilder-IOS-APP',
  appAppleId: null,
  allowedEnvironments: ['Sandbox'],
};

const transactionPayload = {
  transactionId: '2000000000000001',
  productId: 'resumely.exports.5',
  bundleId: sandboxOnly.bundleId,
  type: 'Consumable',
  quantity: 1,
  environment: 'Sandbox',
  appAccountToken: '11111111-1111-4111-8111-111111111111',
};

describe('export packs (spec section 4)', () => {
  it('maps the three new product IDs to 1, 5 and 10 credits', () => {
    expect(EXPORT_PACKS).toEqual({ 'resumely.exports.1': 1, 'resumely.exports.5': 5, 'resumely.exports.10': 10 });
  });

  it.each(['credits_basic', 'credits_saver', 'credits_super', '', '__proto__', 'constructor', 'resumely.exports.2'])(
    'grants nothing for %p',
    (productId) => {
      expect(creditsForProduct(productId)).toBe(0);
    }
  );
});

describe('getAppleIapConfig (spec 7.3, check 1)', () => {
  const full = {
    APPLE_IAP_BUNDLE_ID: 'Resumebuilder-IOS.ResumeBuilder-IOS-APP',
    APPLE_IAP_APP_APPLE_ID: '6740000000',
    APPLE_IAP_ALLOWED_ENVIRONMENTS: 'Production,Sandbox',
  };

  it('reads a complete production config', () => {
    expect(getAppleIapConfig(full)).toEqual({
      bundleId: full.APPLE_IAP_BUNDLE_ID,
      appAppleId: 6740000000,
      allowedEnvironments: ['Production', 'Sandbox'],
    });
  });

  it('allows a Sandbox-only preview without an App Apple ID', () => {
    expect(
      getAppleIapConfig({ APPLE_IAP_BUNDLE_ID: 'b', APPLE_IAP_ALLOWED_ENVIRONMENTS: 'Sandbox' })
    ).toEqual({ bundleId: 'b', appAppleId: null, allowedEnvironments: ['Sandbox'] });
  });

  it.each([
    ['nothing set', {}],
    ['no bundle ID', { ...full, APPLE_IAP_BUNDLE_ID: '' }],
    ['no environments', { ...full, APPLE_IAP_ALLOWED_ENVIRONMENTS: ' , ' }],
    ['an unknown environment', { ...full, APPLE_IAP_ALLOWED_ENVIRONMENTS: 'Production,Xcode' }],
    ['Production without an App Apple ID', { ...full, APPLE_IAP_APP_APPLE_ID: '' }],
    ['a non-numeric App Apple ID', { ...full, APPLE_IAP_APP_APPLE_ID: '67x' }],
  ])('is null (503, never grant) with %s', (_label, env) => {
    expect(getAppleIapConfig(env)).toBeNull();
  });
});

describe('bundled Apple root certificate', () => {
  it('is Apple Root CA - G3 with the published fingerprint', () => {
    const cert = new X509Certificate(APPLE_ROOT_CA_G3_PEM);
    expect(cert.subject).toContain('CN=Apple Root CA - G3');
    expect(cert.fingerprint256).toBe(APPLE_ROOT_CA_G3_SHA256);
    expect(new Date(cert.validTo).getUTCFullYear()).toBe(2039);
  });
});

describe('verifySignedTransaction with the real verifier', () => {
  it('rejects a transaction signed outside Apple\'s chain', async () => {
    await expect(verifySignedTransaction(forgedJws(transactionPayload), sandboxOnly)).resolves.toEqual({
      ok: false,
      reason: 'invalid_transaction',
    });
  });

  it('rejects an environment that is not allowed before verifying', async () => {
    const production = forgedJws({ ...transactionPayload, environment: 'Production' });
    await expect(verifySignedTransaction(production, sandboxOnly)).resolves.toEqual({
      ok: false,
      reason: 'environment_not_allowed',
    });
    const xcode = forgedJws({ ...transactionPayload, environment: 'Xcode' });
    await expect(verifySignedTransaction(xcode, sandboxOnly)).resolves.toEqual({
      ok: false,
      reason: 'environment_not_allowed',
    });
  });

  it.each(['', 'abc', 'a.b', 'a.b.c', `x.${b64url({ productId: 'resumely.exports.1' })}.y`])(
    'rejects malformed input %p',
    async (jws) => {
      await expect(verifySignedTransaction(jws, sandboxOnly)).resolves.toEqual({ ok: false, reason: 'invalid_transaction' });
    }
  );
});

describe('verifySignedNotification with the real verifier', () => {
  it('rejects a notification signed outside Apple\'s chain', async () => {
    const payload = {
      notificationType: 'REFUND',
      notificationUUID: 'n-1',
      data: { environment: 'Sandbox', bundleId: sandboxOnly.bundleId, signedTransactionInfo: forgedJws(transactionPayload) },
    };
    await expect(verifySignedNotification(forgedJws(payload), sandboxOnly)).resolves.toEqual({
      ok: false,
      reason: 'invalid_transaction',
    });
  });

  it('reads the environment from data.environment', async () => {
    const payload = { notificationType: 'REFUND', notificationUUID: 'n-1', data: { environment: 'Production' } };
    await expect(verifySignedNotification(forgedJws(payload), sandboxOnly)).resolves.toEqual({
      ok: false,
      reason: 'environment_not_allowed',
    });
  });
});
