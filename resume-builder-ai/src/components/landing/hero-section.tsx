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
    <section className="relative bg-background pt-12 pb-16 md:pt-24 md:pb-32">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto">
          {/* Hero Title */}
          <h1 className="text-center mb-6">
            <span className="block text-4xl md:text-5xl lg:text-6xl text-foreground font-bold leading-tight mb-2">
              {t("titleLine1")}
            </span>
            <span className="block text-3xl md:text-4xl lg:text-5xl text-mobile-cta font-bold leading-tight">
              {t("titleLine2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-center text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-4 leading-relaxed">
            {t("subtitle")}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8 text-sm md:text-base">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-foreground/70">
                <svg className="w-5 h-5 text-mobile-cta" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-mobile-cta hover:bg-mobile-cta-hover text-white shadow-lg border-0 h-14 px-8 text-base font-semibold group"
            >
              <Link href={ROUTES.auth.signUp} className="flex items-center gap-2">
                {t("ctaPrimary")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-2 h-14 px-8 text-base font-semibold hover:bg-accent"
            >
              <Link href="#features">
                {t("ctaSecondary")}
              </Link>
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 text-xs md:text-sm text-foreground/75">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-mobile-cta border-2 border-background flex items-center justify-center text-white font-bold text-xs"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>
                {t.rich("socialProof.resumesOptimized", {
                  strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                })}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <div className="flex" aria-label="5 out of 5 stars">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-yellow-500 fill-current"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="ms-2">
                {t.rich("socialProof.reviews", {
                  strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-green-700 dark:text-green-300 font-semibold">
                {t("socialProof.atsApproved")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
