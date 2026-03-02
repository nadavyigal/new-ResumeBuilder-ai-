"use client";

import { Link } from "@/navigation";
import { MobileMenu } from "./mobile-menu";

interface MobileHeaderProps {
  user: any;
  title?: string;
}

export function MobileHeader({ user, title }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left: Hamburger Menu */}
        <MobileMenu user={user} />

        {/* Center: Logo or Title */}
        {title ? (
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold truncate max-w-[180px]">
            {title}
          </h1>
        ) : (
          <Link
            href="/dashboard"
            className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mobile-cta to-primary flex items-center justify-center text-white font-bold text-sm shadow-lg">
                R
              </div>
              <span className="font-bold text-lg">Resumely</span>
            </div>
          </Link>
        )}

        {/* Right: Optional Actions */}
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </header>
  );
}
