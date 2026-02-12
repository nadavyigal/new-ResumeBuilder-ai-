"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "@/lib/icons";

export function LoadingState() {
  const t = useTranslations("landing.loadingState");
  const steps = [
    t("steps.parsing"),
    t("steps.keywords"),
    t("steps.scoring"),
    t("steps.improvements"),
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-8 animate-fade-in">
      {/* Animated spinner with pulsing ring */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-mobile-cta/15 border-t-mobile-cta animate-spin" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-b-mobile-cta/30 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-mobile-cta animate-pulse-soft" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">{t("title")}</h3>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 text-start text-sm text-foreground/70 w-full">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 animate-fade-in-up"
            style={{ animationDelay: `${index * 400}ms` }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-mobile-cta/80 animate-pulse-soft" style={{ animationDelay: `${index * 200}ms` }} />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
