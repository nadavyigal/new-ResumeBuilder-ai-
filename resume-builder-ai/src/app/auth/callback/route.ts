import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// This route handles the OAuth and magic link callbacks
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle errors from OAuth providers
  if (error) {
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = '/auth/signin';
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next;
      redirectTo.searchParams.delete('code');
      redirectTo.searchParams.delete('next');
      return NextResponse.redirect(redirectTo);
    }

    console.error('Auth callback error:', error);
  }

  // Fallback redirect to signin
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = '/auth/signin';
  return NextResponse.redirect(redirectTo);
}

