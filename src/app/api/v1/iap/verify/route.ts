import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { creditsForProduct, verifyAppleTransaction } from '@/lib/iap';

export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const appleTransactionId = typeof body?.appleTransactionId === 'string' ? body.appleTransactionId : '';

  if (!productId || !appleTransactionId) {
    return NextResponse.json(
      { error: 'productId and appleTransactionId are required' },
      { status: 400 }
    );
  }

  const grantAmount = creditsForProduct(productId);
  if (!grantAmount) {
    return NextResponse.json({ error: 'unknown_product' }, { status: 400 });
  }

  const verification = await verifyAppleTransaction(appleTransactionId);
  if (process.env.APPLE_VERIFY_TRANSACTIONS_URL && !verification.verified) {
    return NextResponse.json(
      {
        error: 'apple_verification_failed',
        details: verification.message,
      },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any).rpc('grant_apple_credits', {
    p_user_id: user.id,
    p_delta: grantAmount,
    p_reason: `iap_purchase:${productId}`,
    p_source: 'apple_iap',
    p_apple_transaction_id: appleTransactionId,
  });

  if (error) {
    return NextResponse.json(
      { error: 'failed_to_grant_credits', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    creditsGranted: grantAmount,
    balance: typeof data === 'number' ? data : null,
    verification: verification.verified ? 'verified' : 'not_configured',
  });
}
