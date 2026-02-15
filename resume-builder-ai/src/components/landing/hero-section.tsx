"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { ArrowRight } from "@/lib/icons";

export function HeroSection() {
  const t = useTranslations("landing.hero");
  const benefits = t.raw("benefits") as string[];

  return (
    <section className="relative bg-background pt-16 pb-20 md:pt-32 md:pb-40 overflow-hidden">
      <div className="container px-4 mx-auto">
        <div className="max-w-5xl mx-auto">
          {/* Hero Title — dramatic scale */}
          <h1 className="text-center mb-8 animate-fade-in-up">
            <span className="block text-5xl md:text-6xl lg:text-7xl text-foreground font-extrabold leading-[1.1] tracking-tight mb-3">
              {t("titleLine1")}
            </span>
            <span className="block text-4xl md:text-5xl lg:text-6xl text-mobile-cta font-extrabold leading-[1.1] tracking-tight">
              {t("titleLine2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-center text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto mb-6 leading-relaxed animate-fade-in-up stagger-1">
            {t("subtitle")}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-10 text-sm md:text-base animate-fade-in-up stagger-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2.5 text-foreground/80 font-medium">
                <div className="w-6 h-6 rounded-full bg-mobile-cta/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-mobile-cta" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons — bigger, bolder */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in-up stagger-3">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-mobile-cta hover:bg-mobile-cta-hover text-foreground shadow-xl shadow-mobile-cta/25 border-0 h-16 px-10 text-lg font-bold group btn-press"
            >
              <Link href={ROUTES.auth.signUp} className="flex items-center gap-2">
                {t("ctaPrimary")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" aria-hidden="true" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-2 h-16 px-10 text-lg font-bold hover:bg-accent btn-press"
            >
              <Link href="#features">
                {t("ctaSecondary")}
              </Link>
            </Button>
          </div>

          {/* Social Proof - only verified claim */}
          <div className="flex items-center justify-center animate-fade-in stagger-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-green-700 dark:text-green-300 font-semibold text-xs md:text-sm">
                {t("socialProof.atsApproved")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
