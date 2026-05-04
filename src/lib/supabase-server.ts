import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { Database } from '@/types/database';

export const createServerComponentClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
};

function extractBearerToken(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export const createRouteHandlerClient = async (request?: NextRequest) => {
  const cookieStore = await cookies();
  const requestAuthorization = request?.headers.get('authorization');
  const headerStore = await headers();
  const headerAuthorization = headerStore.get('authorization');
  const bearerToken = extractBearerToken(requestAuthorization) ?? extractBearerToken(headerAuthorization);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
      global: bearerToken
        ? {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
            },
          }
        : undefined,
    }
  );
};

export const createServiceRoleClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

// Alias for API routes - exports the route handler client
export { createRouteHandlerClient as createServerClient };
