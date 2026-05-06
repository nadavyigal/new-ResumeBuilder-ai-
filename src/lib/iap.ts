export const CREDIT_PACKS: Record<string, number> = {
  credits_basic: 100,
  credits_saver: 500,
  credits_super: 2500,
};

export function creditsForProduct(productId: string): number {
  return CREDIT_PACKS[productId] ?? 0;
}

export async function verifyAppleTransaction(transactionId: string): Promise<{ verified: boolean; message?: string }> {
  const verifyEndpoint = process.env.APPLE_VERIFY_TRANSACTIONS_URL;
  const bearerToken = process.env.APPLE_VERIFY_BEARER_TOKEN;

  if (!verifyEndpoint || !bearerToken) {
    return {
      verified: false,
      message: 'apple_verification_not_configured',
    };
  }

  const response = await fetch(`${verifyEndpoint.replace(/\/$/, '')}/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      verified: false,
      message: `apple_verification_failed:${response.status}:${text.slice(0, 200)}`,
    };
  }

  return { verified: true };
}
