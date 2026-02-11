"use client";

import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { Home, Upload, User, Briefcase } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");

  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: t("home"),
    },
    {
      href: "/dashboard/applications",
      icon: Briefcase,
      label: t("applications"),
    },
    {
      href: "/dashboard/resume",
      icon: Upload,
      label: t("upload"),
      primary: true,
    },
    {
      href: "/dashboard/profile",
      icon: User,
      label: t("profile"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 pb-safe-bottom" aria-label="Main navigation">
      <div className="relative px-4 pb-4 pt-2">
        <div className="relative bg-card border-2 border-border rounded-[2rem] shadow-xl">
          <div className="relative flex items-center justify-around h-16 px-2">
            {navItems.map(({ href, icon: Icon, label, primary }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center flex-1 gap-1 rounded-2xl transition-colors duration-200 touch-target",
                    primary && "scale-105"
                  )}
                >
                  {isActive && (
                    <div
                      className={cn(
                        "absolute inset-1 rounded-2xl",
                        primary
                          ? "bg-mobile-cta shadow-md"
                          : "bg-primary/10"
                      )}
                    />
                  )}

                  <div className="relative z-10">
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-colors duration-200",
                        isActive
                          ? primary
                            ? "text-white"
                            : "text-primary"
                          : "text-muted-foreground"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden="true"
                    />
                  </div>

                  <span
                    className={cn(
                      "relative z-10 text-[10px] font-medium leading-none",
                      isActive
                        ? primary
                          ? "text-white font-semibold"
                          : "text-primary font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
