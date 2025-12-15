"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Upload, FileSearch, Download } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: Upload,
    title: "Upload Your Resume",
    description:
      "Begin by uploading your current resume in PDF or Word format. Our system will instantly parse and analyze your professional experience, skills, and achievements to create a structured profile.",
  },
  {
    number: 2,
    icon: FileSearch,
    title: "Add Job Description",
    description:
      "Simply paste the job description you're applying for, and our AI will extract key requirements, desired skills, and important keywords to understand exactly what the employer is seeking.",
  },
  {
    number: 3,
    icon: Download,
    title: "Get Optimized Resume",
    description:
      "Receive your professionally optimized resume tailored to the specific job, complete with ATS match insights, keyword optimization, and strategic improvements to maximize your chances of landing an interview.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container px-4 mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto mb-12 md:mb-16 text-center">
          <h2 className="mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground">
            Three simple steps to your optimized resume
          </p>
        </div>

        {/* Mobile: Accordion */}
        <div className="md:hidden max-w-2xl mx-auto">
          <Accordion type="single" collapsible defaultValue="step-1">
            {steps.map((step, index) => (
              <AccordionItem
                key={step.number}
                value={`step-${step.number}`}
                className="border-2 border-border rounded-2xl mb-4 overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors touch-target">
                  <div className="flex items-center gap-4 text-left">
                    {/* Icon Circle */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-mobile-cta to-mobile-cta-hover flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {step.number}
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
                      <step.icon className="w-5 h-5 text-mobile-cta" />
                    </div>
                    <p className="text-sm text-foreground/70 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Desktop: Cards */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="group relative rounded-3xl border-2 border-border bg-card p-8 space-y-6 transition-all duration-300 hover:shadow-2xl hover:scale-105"
              style={{
                animationDelay: `${index * 150}ms`,
              }}
            >
              {/* Step Number - Large and Bold */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mobile-cta to-mobile-cta-hover text-white flex items-center justify-center font-bold text-2xl shadow-xl group-hover:scale-110 transition-transform">
                  {step.number}
                </div>
                {/* Decorative Element */}
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-secondary/30 blur-sm" />
              </div>

              {/* Icon */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
                  <step.icon className="w-6 h-6 text-mobile-cta" />
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
          ))}
        </div>
      </div>
    </section>
  );
}
