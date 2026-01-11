import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { captureServerEvent } from '@/lib/posthog-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');
  redirectTo.searchParams.delete('next');

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
  redirectTo.pathname = '/auth/signin';
  redirectTo.searchParams.set('error', 'confirmation_failed');
  redirectTo.searchParams.set('message', 'Email confirmation failed. Please try signing up again or contact support.');
  return NextResponse.redirect(redirectTo);
}

