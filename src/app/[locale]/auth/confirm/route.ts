import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { captureServerEvent } from '@/lib/posthog-server';
import { defaultLocale, locales, type Locale } from '@/locales';

function resolveLocale(value?: string): Locale {
  if (value && locales.includes(value as Locale)) {
    return value as Locale;
  }
  return defaultLocale;
}

function localePath(locale: Locale, pathname: string) {
  return locale === defaultLocale ? pathname : `/${locale}${pathname}`;
}

function stripLocalePrefix(pathname: string) {
  for (const locale of locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
  }
  return pathname;
}

function getSafeNextPath(nextParam: string | null, locale: Locale, origin: string): string {
  const fallback = localePath(locale, '/dashboard');
  if (!nextParam) return fallback;

  try {
    const parsed = new URL(nextParam, origin);
    if (parsed.origin !== origin) return fallback;
    if (!parsed.pathname.startsWith('/')) return fallback;

    const normalizedPath = stripLocalePrefix(parsed.pathname);
    const normalizedWithLocale = localePath(locale, normalizedPath);
    return `${normalizedWithLocale}${parsed.search}`;
  } catch {
    return fallback;
  }
}

function applyRelativePath(url: URL, pathWithSearch: string) {
  const target = new URL(pathWithSearch, url.origin);
  url.pathname = target.pathname;
  url.search = target.search;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await context.params;
  const locale = resolveLocale(rawLocale);

  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = getSafeNextPath(searchParams.get('next'), locale, request.nextUrl.origin);

  const redirectTo = request.nextUrl.clone();
  applyRelativePath(redirectTo, next);

  if (token_hash && type) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      // Successfully verified - track signup completion
      await captureServerEvent(data.user.id, 'signup_completed', {
        method: 'email',
        source: 'email_confirmation',
        user_id: data.user.id,
        email: data.user.email,
      });

      // Redirect to dashboard or specified path
      return NextResponse.redirect(redirectTo);
    }

    console.error('Email confirmation error:', error);
  }

  // Return the user to an error page with some instructions
  redirectTo.pathname = localePath(locale, '/auth/signin');
  redirectTo.search = '';
  redirectTo.searchParams.set('error', 'confirmation_failed');
  redirectTo.searchParams.set('message', 'Email confirmation failed. Please try signing up again or contact support.');
  return NextResponse.redirect(redirectTo);
}

