"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { createClientComponentClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { Menu, X } from "lucide-react";

export function Header() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  return (
    <header className="w-full border-b-2 border-border bg-background">
      <div className="container px-4 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 md:py-4">
          {/* Logo */}
          <Link href={ROUTES.home} className="flex items-center">
            <span className="font-bold text-lg sm:text-xl text-foreground px-4 py-2 border-2 border-foreground rounded-full hover:bg-foreground hover:text-background transition-all duration-200">
              RESUMELY
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-4 text-sm font-medium text-foreground/80">
              <Link href={ROUTES.home} className="hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href={`${ROUTES.home}#features`} className="hover:text-foreground transition-colors">
                Features
              </Link>
              {user && (
                <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              )}
            </nav>

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
              <Link href={ROUTES.auth.signUp}>
                <Button variant="outline" size="sm">
                  Get Started
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`md:hidden ${isMenuOpen ? "block" : "hidden"}`}>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
            <nav className="space-y-2 text-base font-medium">
              <Link
                href={ROUTES.home}
                className="block w-full rounded-xl px-3 py-2 hover:bg-muted transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href={`${ROUTES.home}#features`}
                className="block w-full rounded-xl px-3 py-2 hover:bg-muted transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              {user && (
                <Link
                  href={ROUTES.dashboard}
                  className="block w-full rounded-xl px-3 py-2 hover:bg-muted transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
            </nav>

            <div className="grid gap-2">
              {user ? (
                <>
                  <Button asChild className="w-full">
                    <Link href={ROUTES.dashboard} onClick={() => setIsMenuOpen(false)}>
                      Go to Dashboard
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await handleSignOut();
                      setIsMenuOpen(false);
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="w-full">
                    <Link href={ROUTES.auth.signUp} onClick={() => setIsMenuOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={ROUTES.auth.signIn} onClick={() => setIsMenuOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}