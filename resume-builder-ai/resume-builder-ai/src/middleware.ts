import createIntlMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "@/locales";

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as Locale) ? (segment as Locale) : defaultLocale;
}

function stripLocale(pathname: string, locale: Locale): string {
  if (locale !== defaultLocale && pathname.startsWith(`/${locale}`)) {
    const stripped = pathname.slice(locale.length + 1);
    return stripped.length ? stripped : "/";
  }
  return pathname;
}

function withLocale(pathname: string, locale: Locale): string {
  if (locale === defaultLocale) return pathname;
  return `/${locale}${pathname}`;
}

export async function middleware(request: NextRequest) {
  try {
    const response = intlMiddleware(request);

    if (response.headers.get("location")) {
      return response;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseUrl.includes("your-project-id") ||
      supabaseAnonKey.includes("placeholder")
    ) {
      console.log("Middleware: Supabase not configured, skipping auth");
      return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    });

    let user = null;

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      console.warn("Supabase authentication failed:", error);
      return response;
    }

    const locale = getLocaleFromPathname(request.nextUrl.pathname);
    const pathname = stripLocale(request.nextUrl.pathname, locale);

    if (pathname.startsWith("/dashboard") && !user) {
      return NextResponse.redirect(new URL(withLocale("/auth/signin", locale), request.url));
    }

    if (user && pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL(withLocale("/dashboard", locale), request.url));
    }

    return response;
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
