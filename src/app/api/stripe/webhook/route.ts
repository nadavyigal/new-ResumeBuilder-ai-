import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeConfig, isStripeConfigured } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase-server";

// Disable body parsing - Stripe needs raw body for signature verification
export const runtime = 'nodejs';

/**
 * Stripe webhook handler with signature verification
 *
 * Handles the following events:
 * - checkout.session.completed: User completed payment, upgrade to premium
 * - customer.subscription.deleted: User cancelled subscription, downgrade to free
 * - customer.subscription.updated: Subscription status changed
 */
export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    console.error("Stripe webhook called but Stripe is not configured");
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    const stripeConfig = getStripeConfig();
    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        stripeConfig.webhookSecret
      );
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook processing failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout - upgrade user to premium
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  const supabase = createServiceRoleClient();

  // Update user profile to premium
  const { error } = await supabase
    .from("profiles")
    .update({
      plan_type: "premium",
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to upgrade user to premium:", error);
    throw error;
  }

  console.log(`User ${userId} upgraded to premium`);
}

/**
 * Handle subscription deletion - downgrade user to free
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceRoleClient();

  // Find user by subscription ID
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (fetchError || !profile) {
    console.error("Failed to find user for subscription:", subscription.id);
    return;
  }

  // Downgrade to free plan
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      plan_type: "free",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.user_id);

  if (updateError) {
    console.error("Failed to downgrade user to free:", updateError);
    throw updateError;
  }

  console.log(`User ${profile.user_id} downgraded to free`);
}

/**
 * Handle subscription update - sync status with Stripe
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceRoleClient();

  // Find user by subscription ID
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id, plan_type")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (fetchError || !profile) {
    console.error("Failed to find user for subscription:", subscription.id);
    return;
  }

  // Determine plan based on subscription status
  const isActive = ["active", "trialing"].includes(subscription.status);
  const newPlanType = isActive ? "premium" : "free";

  // Only update if plan type changed
  if (profile.plan_type !== newPlanType) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plan_type: newPlanType,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);

    if (updateError) {
      console.error("Failed to update user plan:", updateError);
      throw updateError;
    }

    console.log(`User ${profile.user_id} plan updated to ${newPlanType}`);
  }
}

/**
 * Handle payment failure - log for monitoring
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.error("Payment failed for invoice:", invoice.id);
  // TODO: Send notification to user about payment failure
  // Could store event in events table for tracking
}



