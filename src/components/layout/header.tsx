"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { createClientComponentClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export function Header() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="w-full border-b-2 border-border bg-background py-4">
      <div className="container flex items-center justify-between px-4">
        {/* Logo */}
        <Link href={ROUTES.home} className="flex items-center">
          <span className="font-bold text-xl text-foreground px-6 py-2 border-2 border-foreground rounded-full hover:bg-foreground hover:text-background transition-all duration-200">
            RESUMELY
          </span>
        </Link>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link href={ROUTES.dashboard}>
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Link href={ROUTES.auth.signIn}>
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href={ROUTES.auth.signUp}>
                <Button variant="default" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}