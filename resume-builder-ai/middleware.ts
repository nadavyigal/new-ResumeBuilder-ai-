import { NextResponse, type NextRequest } from 'next/server';

// Explicitly declare Edge Runtime
export const runtime = 'edge';

/**
 * Minimal middleware - authentication moved to page-level checks
 *
 * Edge Runtime limitations prevent using Supabase SSR client here.
 * Auth protection is now handled by:
 * 1. Server Components checking auth state
 * 2. Client-side redirects in auth provider
 * 3. API route-level auth checks
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add cache-busting headers to prevent stale query issues
  response.headers.set('X-App-Version', '3.0.0');
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};