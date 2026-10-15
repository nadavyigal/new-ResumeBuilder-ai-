import { afterEach, describe, expect, it } from '@jest/globals';
import { verifyAppleTransaction } from '@/lib/iap';

// The verify route grants credits only on `verified: true`. These tests pin the
// two ways the helper says no without calling Apple: no configuration at all,
// and half a configuration.

describe('verifyAppleTransaction', () => {
  const previousUrl = process.env.APPLE_VERIFY_TRANSACTIONS_URL;
  const previousToken = process.env.APPLE_VERIFY_BEARER_TOKEN;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.APPLE_VERIFY_TRANSACTIONS_URL;
    else process.env.APPLE_VERIFY_TRANSACTIONS_URL = previousUrl;
    if (previousToken === undefined) delete process.env.APPLE_VERIFY_BEARER_TOKEN;
    else process.env.APPLE_VERIFY_BEARER_TOKEN = previousToken;
  });

  it('is not verified when nothing is configured', async () => {
    delete process.env.APPLE_VERIFY_TRANSACTIONS_URL;
    delete process.env.APPLE_VERIFY_BEARER_TOKEN;

    await expect(verifyAppleTransaction('txn-1')).resolves.toEqual({
      verified: false,
      message: 'apple_verification_not_configured',
    });
  });

  it('is not verified when only the URL is configured', async () => {
    process.env.APPLE_VERIFY_TRANSACTIONS_URL = 'https://verify.invalid';
    delete process.env.APPLE_VERIFY_BEARER_TOKEN;

    await expect(verifyAppleTransaction('txn-1')).resolves.toEqual({
      verified: false,
      message: 'apple_verification_not_configured',
    });
  });
});
