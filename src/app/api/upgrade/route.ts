import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase-server";
import { defaultLocale, locales, type Locale } from "@/locales";

function normalizeLocale(locale?: string): Locale {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return defaultLocale;
}

function withLocalePath(pathname: string, locale: Locale) {
  return locale === defaultLocale ? pathname : `/${locale}${pathname}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { plan, locale: rawLocale } = await req.json();
    if (plan !== "premium") {
      return NextResponse.json(
        { success: false, code: "INVALID_PLAN", error: "Invalid plan type" },
        { status: 400 }
      );
    }
    const locale = normalizeLocale(rawLocale);

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripePriceId = process.env.STRIPE_PRICE_ID_PREMIUM;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    if (!stripeSecretKey || !stripePriceId) {
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_NOT_CONFIGURED",
          error: "Stripe is not configured for this environment"
        },
        { status: 503 }
      );
    }

    const payload = new URLSearchParams();
    payload.set("mode", "subscription");
    payload.set("success_url", `${appUrl}${withLocalePath("/dashboard", locale)}?upgraded=true&session_id={CHECKOUT_SESSION_ID}`);
    payload.set("cancel_url", `${appUrl}${withLocalePath("/pricing", locale)}?upgrade=cancelled`);
    payload.set("line_items[0][price]", stripePriceId);
    payload.set("line_items[0][quantity]", "1");
    payload.set("client_reference_id", user.id);
    payload.set("metadata[user_id]", user.id);
    payload.set("metadata[plan]", "premium");
    if (user.email) {
      payload.set("customer_email", user.email);
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Stripe session creation failed:", errorText);
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_PROVIDER_ERROR",
          error: "Failed to create checkout session"
        },
        { status: 502 }
      );
    }

    const session = (await response.json()) as { id?: string; url?: string };
    if (!session.id || !session.url) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PROVIDER_RESPONSE",
          error: "Invalid checkout session response"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error: unknown) {
    console.error("Upgrade error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: "Failed to create checkout session"
      },
      { status: 500 }
    );
  }
}
