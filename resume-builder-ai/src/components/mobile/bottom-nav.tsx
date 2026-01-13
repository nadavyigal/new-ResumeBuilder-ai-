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
      primary: true, // Highlighted action
    },
    {
      href: "/dashboard/profile",
      icon: User,
      label: t("profile"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 pb-safe-bottom">
      {/* Backdrop blur container */}
      <div className="relative px-4 pb-4 pt-2">
        {/* Glass-morphism floating pill */}
        <div className="relative bg-card/80 backdrop-blur-xl border-2 border-border rounded-[2rem] shadow-2xl overflow-hidden">
          {/* Subtle gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/5 to-transparent pointer-events-none" />

          {/* Navigation items */}
          <div className="relative flex items-center justify-around h-16 px-2">
            {navItems.map(({ href, icon: Icon, label, primary }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center justify-center flex-1 gap-1 rounded-2xl transition-all duration-300 touch-target group",
                    primary && "scale-110"
                  )}
                >
                  {/* Active background - liquid fill effect */}
                  {isActive && (
                    <div
                      className={cn(
                        "absolute inset-1 rounded-2xl transition-all duration-500",
                        primary
                          ? "bg-gradient-to-br from-mobile-cta to-mobile-cta-hover shadow-lg shadow-mobile-cta/30"
                          : "bg-primary/10"
                      )}
                      style={{
                        animation: "liquidFill 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)"
                      }}
                    />
                  )}

                  {/* Icon with smooth color transition */}
                  <div className="relative z-10">
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-all duration-300",
                        isActive
                          ? primary
                            ? "text-white drop-shadow-sm"
                            : "text-primary"
                          : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>

                  {/* Label with fade transition */}
                  <span
                    className={cn(
                      "relative z-10 text-[10px] font-medium transition-all duration-300 leading-none",
                      isActive
                        ? primary
                          ? "text-white font-semibold"
                          : "text-primary font-semibold"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {label}
                  </span>

                  {/* Hover glow effect */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes liquidFill {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </nav>
  );
}
