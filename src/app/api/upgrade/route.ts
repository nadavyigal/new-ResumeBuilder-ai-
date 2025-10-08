import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";

/**
 * Upgrade API Endpoint
 * Epic 5: FR-023 & FR-024 - Premium subscription with payment processing
 *
 * Creates Stripe checkout session for premium subscription
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { plan } = await req.json();

    if (plan !== "premium") {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    // FR-024: Payment processing integration
    // TODO: Integrate with Stripe Checkout
    // This is a placeholder implementation

    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn("STRIPE_SECRET_KEY not configured - returning placeholder response");

      // Development mode: Simulate immediate upgrade
      if (process.env.NODE_ENV === "development") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ plan_type: "premium" })
          .eq("user_id", user.id);

        if (updateError) {
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          message: "Development mode: Upgraded to premium directly",
          checkoutUrl: null,
        });
      }

      return NextResponse.json({
        error: "Payment processing not configured",
        message: "Stripe integration pending",
      }, { status: 503 });
    }

    /**
     * Production Stripe Integration (FR-024):
     *
     * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
     *
     * const session = await stripe.checkout.sessions.create({
     *   customer_email: user.email,
     *   client_reference_id: user.id,
     *   payment_method_types: ['card'],
     *   mode: 'subscription',
     *   line_items: [{
     *     price: process.env.STRIPE_PRICE_ID_PREMIUM,
     *     quantity: 1,
     *   }],
     *   success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
     *   cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=cancelled`,
     *   metadata: {
     *     userId: user.id,
     *     plan: 'premium',
     *   },
     * });
     *
     * return NextResponse.json({
     *   success: true,
     *   checkoutUrl: session.url,
     *   sessionId: session.id,
     * });
     */

    return NextResponse.json({
      error: "Stripe integration pending",
      message: "Payment processing will be available soon",
    }, { status: 503 });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Upgrade error:", error);

    return NextResponse.json({
      error: "Failed to create checkout session",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}

/**
 * Webhook endpoint for Stripe events
 * Epic 5: FR-024 - Handle successful payments
 *
 * Processes Stripe webhook events to update user subscription status
 */
export async function WEBHOOK(req: NextRequest) {
  const supabase = await createRouteHandlerClient();

  try {
    const signature = req.headers.get("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    /**
     * Production Stripe Webhook Handler (FR-024):
     *
     * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
     * const body = await req.text();
     *
     * const event = stripe.webhooks.constructEvent(
     *   body,
     *   signature,
     *   process.env.STRIPE_WEBHOOK_SECRET
     * );
     *
     * if (event.type === 'checkout.session.completed') {
     *   const session = event.data.object as Stripe.Checkout.Session;
     *   const userId = session.client_reference_id || session.metadata?.userId;
     *
     *   if (userId) {
     *     await supabase
     *       .from('profiles')
     *       .update({
     *         plan_type: 'premium',
     *         stripe_customer_id: session.customer,
     *         stripe_subscription_id: session.subscription,
     *       })
     *       .eq('user_id', userId);
     *   }
     * }
     *
     * if (event.type === 'customer.subscription.deleted') {
     *   const subscription = event.data.object as Stripe.Subscription;
     *   const customerId = subscription.customer;
     *
     *   await supabase
     *     .from('profiles')
     *     .update({ plan_type: 'free' })
     *     .eq('stripe_customer_id', customerId);
     * }
     *
     * return NextResponse.json({ received: true });
     */

    return NextResponse.json({ error: "Webhook not implemented" }, { status: 501 });

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Webhook error:", error);

    return NextResponse.json({
      error: "Webhook processing failed",
      details: err.message || "Unknown error",
    }, { status: 500 });
  }
}
