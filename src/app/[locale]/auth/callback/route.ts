import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { captureServerEvent } from '@/lib/posthog-server';
import { createServiceRoleClient } from '@/lib/supabase-server';
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
    if (normalizedPath.startsWith('/auth/callback')) return fallback;

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

// This route handles the OAuth, magic link, and email confirmation callbacks
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await context.params;
  const locale = resolveLocale(rawLocale);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeNextPath(searchParams.get('next'), locale, request.nextUrl.origin);
  const sessionId = searchParams.get('session_id');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle errors from OAuth providers or email confirmation
  if (error) {
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = localePath(locale, '/auth/signin');
    redirectTo.searchParams.set('error', error);
    redirectTo.searchParams.set('message', error_description || 'Authentication failed');
    return NextResponse.redirect(redirectTo);
  }

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Track successful authentication
      await captureServerEvent(data.user.id, 'signup_completed', {
        method: 'email',
        source: 'email_confirmation',
        user_id: data.user.id,
        email: data.user.email,
      });

      if (sessionId) {
        try {
          const serviceRole = createServiceRoleClient();
          const { data: anonScore } = await serviceRole
            .from('anonymous_ats_scores')
            .select('id, ats_score, created_at')
            .eq('session_id', sessionId)
            .is('user_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (anonScore) {
            await serviceRole
              .from('anonymous_ats_scores')
              .update({
                user_id: data.user.id,
                converted_at: new Date().toISOString(),
              })
              .eq('id', anonScore.id);

            await captureServerEvent(data.user.id, 'ats_checker_session_converted', {
              sessionId,
              score: anonScore.ats_score,
              convertedAt: new Date().toISOString(),
            });
          }
        } catch (conversionError) {
          console.error('Session conversion error:', conversionError);
        }
      }

      const redirectTo = request.nextUrl.clone();
      applyRelativePath(redirectTo, next);
      return NextResponse.redirect(redirectTo);
    }

    console.error('Auth callback error:', error);

    // If there was an error, redirect to signin with error message
    if (error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = localePath(locale, '/auth/signin');
      redirectTo.searchParams.set('error', 'confirmation_failed');
      redirectTo.searchParams.set('message', error.message || 'Email confirmation failed. Please try again.');
      return NextResponse.redirect(redirectTo);
    }
  }

  // Fallback redirect to signin
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = localePath(locale, '/auth/signin');
  redirectTo.searchParams.set('message', 'Please sign in to continue');
  return NextResponse.redirect(redirectTo);
}

