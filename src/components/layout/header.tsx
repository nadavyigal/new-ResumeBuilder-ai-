"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClientComponentClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ROUTES } from "@/lib/constants";

export function Header() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const t = useTranslations("header");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="w-full border-b-2 border-border bg-background py-4">
      <div className="container flex min-w-0 items-center justify-between gap-3 px-4">
        {/* Logo */}
        <Link href={ROUTES.home} className="flex min-w-0 items-center">
          <span className="rounded-full border-2 border-foreground px-4 py-2 text-lg font-bold text-foreground transition-all duration-200 hover:bg-foreground hover:text-background md:px-6 md:text-xl">
            RESUMELY
          </span>
        </Link>

        {/* Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href={ROUTES.pricing} className="hidden sm:block">
            <Button variant="ghost" size="sm">
              {t("pricing")}
            </Button>
          </Link>
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-3">
              <Link href={ROUTES.dashboard}>
                <Button variant="ghost" size="sm">
                  {t("dashboard")}
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                {t("signOut")}
              </Button>
            </div>
          ) : (
            <>
              <Link href={ROUTES.auth.signIn}>
                <Button variant="ghost" size="sm">
                  {t("logIn")}
                </Button>
              </Link>
              <Link href={ROUTES.auth.signUp}>
                <Button variant="default" size="sm">
                  {t("signUp")}
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center md:hidden">
          <LanguageSwitcher compact />
        </div>
      </div>
    </header>
  );
}
