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
    <div className="flex flex-col items-center text-center space-y-6 py-6">
      <div className="w-16 h-16 rounded-full border-4 border-foreground/10 border-t-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      </div>
      <div className="grid gap-2 text-left text-sm text-foreground/70 w-full">
        {steps.map((step) => (
          <div key={step} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-mobile-cta/80" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
