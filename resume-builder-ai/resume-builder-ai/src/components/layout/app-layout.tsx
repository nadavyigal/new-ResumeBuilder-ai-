"use client";

import { ReactNode } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { Header } from "@/components/layout/header";

interface AppLayoutProps {
  children: ReactNode;
  user?: any;
  title?: string;
}

export function AppLayout({ children, user, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header - hidden on mobile */}
      <div className="hidden md:block">
        <Header />
      </div>

      {/* Mobile Header - hidden on desktop */}
      {user && (
        <div className="md:hidden">
          <MobileHeader user={user} title={title} />
        </div>
      )}

      {/* Main Content - with bottom padding on mobile for nav */}
      <main className="pb-24 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation - hidden on desktop */}
      {user && <BottomNav />}
    </div>
  );
}
