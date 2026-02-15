"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "@/lib/icons";

export function LoadingState() {
  const t = useTranslations("landing.loadingState");
  const steps = useMemo(() => [
    t("steps.parsing"),
    t("steps.keywords"),
    t("steps.scoring"),
    t("steps.improvements"),
  ], [t]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    setActiveStepIndex(0);
    const interval = setInterval(() => {
      setActiveStepIndex((current) => {
        if (current >= steps.length - 1) return current;
        return current + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [steps.length]);

  const progress = Math.round(((activeStepIndex + 1) / steps.length) * 100);

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-6">
      <div className="w-16 h-16 rounded-full border-4 border-foreground/10 border-t-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{t("title")}</h3>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        <p className="text-xs text-foreground/60" aria-live="polite">
          {t("progress", { percent: progress })}
        </p>
      </div>
      <div className="w-full h-2 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full bg-[hsl(142_76%_24%)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="grid gap-2 text-left text-sm text-foreground/70 w-full">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2" aria-live={index === activeStepIndex ? "polite" : undefined}>
            {index < activeStepIndex ? (
              <Check className="w-4 h-4 text-[hsl(142_76%_24%)]" />
            ) : index === activeStepIndex ? (
              <Loader2 className="w-4 h-4 text-[hsl(142_76%_24%)] animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-foreground/30" />
            )}
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
