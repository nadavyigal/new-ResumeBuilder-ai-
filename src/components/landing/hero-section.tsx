"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { Sparkles, ArrowRight } from "@/lib/icons";

export function HeroSection() {
  const t = useTranslations("landing.hero");
  const benefits = t.raw("benefits") as string[];

  return (
    <section className="relative overflow-hidden bg-background pt-12 pb-16 md:pt-24 md:pb-32">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-mobile-cta/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-mobile-cta/20 to-secondary/20 border-2 border-mobile-cta/30 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-mobile-cta animate-pulse" />
              <span className="text-sm font-semibold text-foreground">
                {t("badge")}
              </span>
            </div>
          </div>

          {/* Hero Title */}
          <h2 className="text-center mb-6 animate-slideUp">
            <span className="block text-4xl md:text-5xl lg:text-6xl text-foreground font-bold leading-tight mb-2">
              {t("titleLine1")}
            </span>
            <span className="block text-3xl md:text-4xl lg:text-5xl bg-gradient-to-r from-mobile-cta via-primary to-secondary bg-clip-text text-transparent font-bold leading-tight">
              {t("titleLine2")}
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-center text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-4 leading-relaxed animate-slideUp delay-100">
            {t("subtitle")}
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8 text-sm md:text-base animate-slideUp delay-150">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-foreground/70">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slideUp delay-200">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-[hsl(142_76%_24%)] hover:bg-[hsl(142_76%_20%)] text-white shadow-xl shadow-mobile-cta/30 border-0 h-14 px-8 text-base font-semibold group"
            >
              <Link href={ROUTES.auth.signUp} className="flex items-center gap-2">
                {t("ctaPrimary")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 text-xs md:text-sm text-foreground/75 animate-slideUp delay-300">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-foreground border-2 border-background flex items-center justify-center text-background font-bold text-xs"
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
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  className="w-4 h-4 text-yellow-500 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
              <span className="ml-2">
                {t.rich("socialProof.reviews", {
                  strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-green-700 dark:text-green-300 font-semibold">
                {t("socialProof.atsApproved")}
              </span>
            </div>
          </div>
        </div>
      </div>


      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .delay-100 {
          animation-delay: 0.1s;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        .delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        .delay-300 {
          animation-delay: 0.3s;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        .delay-500 {
          animation-delay: 0.5s;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }
      `}</style>
    </section>
  );
}
