import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Wrap entire middleware in try-catch to prevent runtime crashes
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Check if Supabase credentials are properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip authentication if Supabase is not properly configured
    if (!supabaseUrl || !supabaseAnonKey ||
        supabaseUrl.includes('your-project-id') ||
        supabaseAnonKey.includes('placeholder')) {
      console.log('Middleware: Supabase not configured, skipping auth');
      return response;
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    let user = null;

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      // If Supabase authentication fails, continue without authentication
      console.warn('Supabase authentication failed:', error);
      return response;
    }

    // Protect dashboard and other authenticated routes
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Redirect authenticated users away from auth pages
    if (user && request.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  } catch (error) {
    // If middleware fails entirely, log error and allow request to proceed
    console.error('Middleware error:', error);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

// Temporarily disable middleware to diagnose the error
// The matcher is set to never match any paths
export const config = {
  matcher: [],
};