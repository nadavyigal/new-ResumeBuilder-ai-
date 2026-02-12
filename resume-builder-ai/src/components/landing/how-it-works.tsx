"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Upload, FileSearch, Download } from "@/lib/icons";
import { useTranslations } from "next-intl";

export function HowItWorks() {
  const t = useTranslations("landing.howItWorks");
  const steps = t.raw("steps") as Array<{ title: string; description: string }>;
  const stepIcons = [Upload, FileSearch, Download];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-accent/30 to-background">
      <div className="container px-4 mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto mb-12 md:mb-20 text-center">
          <h2 className="mb-4 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">{t("title")}</h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* Mobile: Accordion */}
        <div className="md:hidden max-w-2xl mx-auto">
          <Accordion type="single" collapsible defaultValue="step-1">
            {steps.map((step, index) => {
              const StepIcon = stepIcons[index];
              if (!StepIcon) return null;
              return (
              <AccordionItem
                key={`step-${index + 1}`}
                value={`step-${index + 1}`}
                className="border-2 border-border rounded-2xl mb-4 overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors touch-target">
                  <div className="flex items-center gap-4 text-start">
                    {/* Icon Circle */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-mobile-cta to-mobile-cta-hover flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {index + 1}
                    </div>
                    {/* Title */}
                    <span className="font-bold text-base text-foreground">
                      {step.title}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <StepIcon className="w-5 h-5 text-mobile-cta" />
                    </div>
                    <p className="text-sm text-foreground/70 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
            })}
          </Accordion>
        </div>

        {/* Desktop: Cards */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const StepIcon = stepIcons[index];
            if (!StepIcon) return null;
            return (
            <div
              key={`step-${index + 1}`}
              className="group relative rounded-3xl border-2 border-border bg-card p-8 space-y-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 animate-fade-in-up"
              style={{
                animationDelay: `${index * 150}ms`,
              }}
            >
              {/* Step Number - Large and Bold */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mobile-cta to-mobile-cta-hover text-white flex items-center justify-center font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform">
                  {index + 1}
                </div>
                {/* Decorative Element */}
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary/30 blur-sm" />
              </div>

              {/* Icon */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
                  <StepIcon className="w-6 h-6 text-mobile-cta" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  {step.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-base text-foreground/60 leading-relaxed">
                {step.description}
              </p>

              {/* Decorative arrow for flow */}
              {index < steps.length - 1 && (
                <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 text-muted-foreground hidden xl:block">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}
