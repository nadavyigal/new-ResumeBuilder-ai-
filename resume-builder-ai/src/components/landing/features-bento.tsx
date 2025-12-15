"use client";

import { Sparkles, Target, Zap, Shield, TrendingUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Optimization",
    description: "Advanced AI analyzes job descriptions and optimizes your resume automatically with intelligent keyword matching",
    span: "md:col-span-2 md:row-span-2",
    gradient: "from-mobile-cta/20 to-mobile-cta/5",
    iconBg: "bg-gradient-to-br from-mobile-cta to-mobile-cta-hover",
  },
  {
    icon: Target,
    title: "ATS-Optimized",
    description: "Get match scores and keyword optimization to pass applicant tracking systems",
    span: "md:col-span-1",
    gradient: "from-secondary/20 to-secondary/5",
    iconBg: "bg-gradient-to-br from-secondary to-accent",
  },
  {
    icon: Zap,
    title: "Fast Results",
    description: "Generate optimized resumes in minutes",
    span: "md:col-span-1",
    gradient: "from-primary/10 to-primary/5",
    iconBg: "bg-gradient-to-br from-primary to-primary/70",
  },
  {
    icon: FileText,
    title: "Professional Templates",
    description: "Choose from beautiful, ATS-friendly templates designed by experts",
    span: "md:col-span-1",
    gradient: "from-accent/20 to-accent/5",
    iconBg: "bg-gradient-to-br from-accent to-secondary",
  },
  {
    icon: TrendingUp,
    title: "3x Interview Rate",
    description: "Our users see up to 3x more interview invitations on average",
    span: "md:col-span-1",
    gradient: "from-mobile-cta/10 to-mobile-cta/5",
    iconBg: "bg-gradient-to-br from-mobile-cta to-primary",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data is encrypted and never shared with third parties. We respect your privacy.",
    span: "md:col-span-2",
    gradient: "from-muted/50 to-muted/20",
    iconBg: "bg-gradient-to-br from-foreground to-foreground/80",
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="py-16 md:py-24 bg-muted/30">
      <div className="container px-4 mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto mb-12 md:mb-16 text-center">
          <h2 className="mb-4">
            Why Choose Our AI Resume Optimizer
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to create resumes that get you hired
          </p>
        </div>

        {/* Bento Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                "group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-6 md:p-8 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]",
                feature.span
              )}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Gradient Background */}
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-70",
                  feature.gradient
                )}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Icon */}
                <div
                  className={cn(
                    "w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                    feature.iconBg
                  )}
                >
                  <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-white" strokeWidth={2} />
                </div>

                {/* Title */}
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 md:mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm md:text-base text-foreground/70 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-foreground/5 rounded-tl-full transform translate-x-12 translate-y-12 group-hover:translate-x-8 group-hover:translate-y-8 transition-transform duration-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Stats Row */}
        <div className="max-w-4xl mx-auto mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Resumes Optimized", value: "10K+" },
            { label: "Average Match Score", value: "92%" },
            { label: "Interview Rate Increase", value: "3x" },
            { label: "Satisfaction Rate", value: "4.9/5" },
          ].map((stat, index) => (
            <div
              key={index}
              className="text-center p-4 rounded-2xl bg-card border-2 border-border"
            >
              <div className="text-2xl md:text-3xl font-bold text-mobile-cta mb-1">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
