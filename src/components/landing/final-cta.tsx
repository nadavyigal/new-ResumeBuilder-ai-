"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/lib/icons";

export function FinalCta() {
  const t = useTranslations("landing.finalCta");

  const handleCtaClick = () => {
    const uploadCard = document.getElementById("ats-upload");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    uploadCard?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    const fileInput = document.getElementById("resume") as HTMLInputElement | null;
    fileInput?.focus();
  };

  return (
    <section id="final-cta" className="py-16 md:py-24 bg-muted/30">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={handleCtaClick}
            className="w-full sm:w-auto bg-mobile-cta hover:bg-mobile-cta-hover text-foreground shadow-xl shadow-mobile-cta/25 border-0 h-16 px-10 text-lg font-bold group btn-press"
          >
            <span className="flex items-center gap-2">
              {t("cta")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}
