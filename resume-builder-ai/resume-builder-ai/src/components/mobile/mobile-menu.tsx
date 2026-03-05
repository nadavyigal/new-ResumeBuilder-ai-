"use client";

import { useState } from "react";
import { Link } from "@/navigation";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Home, Upload, Briefcase, Palette, Settings, HelpCircle, LogOut, Sparkles } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@/lib/supabase";
import { useTranslations } from "next-intl";

interface MobileMenuProps {
  user: any;
}

export function MobileMenu({ user }: MobileMenuProps) {
  const t = useTranslations("dashboard.mobileMenu");
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClientComponentClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const menuItems = [
    { href: "/dashboard", icon: Home, label: t("dashboard") },
    { href: "/dashboard/resume", icon: Upload, label: t("uploadResume") },
    { href: "/dashboard/applications", icon: Briefcase, label: t("applications") },
    { href: "/templates", icon: Palette, label: t("templates") },
  ];

  const secondaryItems = [
    { href: "/settings", icon: Settings, label: t("settings") },
    { href: "/help", icon: HelpCircle, label: t("helpSupport") },
  ];

  return (
    <>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="md:hidden relative group touch-target"
      >
        <div className="relative">
          <Menu className="w-6 h-6 transition-transform group-hover:scale-110" />
          {/* Subtle pulse animation */}
          <div className="absolute inset-0 bg-primary/20 rounded-full scale-0 group-hover:scale-150 opacity-0 group-hover:opacity-100 transition-all duration-300" />
        </div>
      </Button>

      {/* Slide-in Menu Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="left"
          className="w-[300px] p-0 bg-gradient-to-b from-background via-background to-muted/20"
        >
          {/* Close button with creative positioning */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors touch-target"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col h-full">
            {/* User Profile Header */}
            <SheetHeader className="p-6 pb-4 border-b-2 border-border/50">
              <div className="flex items-center gap-4">
                {/* Avatar with gradient border */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-mobile-cta to-secondary rounded-full blur-sm opacity-75" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xl border-2 border-background">
                    {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg font-bold text-start truncate">
                    {user?.user_metadata?.full_name || t("userFallback")}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Premium badge if applicable */}
              {user?.user_metadata?.is_premium && (
                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/30 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs font-semibold text-yellow-700">{t("premium")}</span>
                </div>
              )}
            </SheetHeader>

            {/* Main Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {menuItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 touch-target group relative overflow-hidden",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {/* Slide-in background effect */}
                    {isActive && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80"
                        style={{
                          animation: "slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
                        }}
                      />
                    )}

                    <Icon
                      className={cn(
                        "relative z-10 w-5 h-5 transition-transform duration-300",
                        isActive
                          ? "scale-110"
                          : "group-hover:scale-110 group-hover:rotate-3"
                      )}
                    />
                    <span className="relative z-10 font-medium">{label}</span>

                    {/* Active indicator dot */}
                    {isActive && (
                      <div className="relative z-10 ms-auto w-2 h-2 rounded-full bg-primary-foreground" />
                    )}
                  </Link>
                );
              })}

              {/* Divider */}
              <div className="my-4 border-t-2 border-dashed border-border/50" />

              {/* Secondary Items */}
              {secondaryItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200 touch-target",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out Button */}
            <div className="p-4 border-t-2 border-border/50">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">{t("signOut")}</span>
              </Button>
            </div>
          </div>

          <style jsx>{`
            @keyframes slideIn {
              from {
                transform: translateX(-100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
        </SheetContent>
      </Sheet>
    </>
  );
}
