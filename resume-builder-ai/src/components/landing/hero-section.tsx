"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { Sparkles, ArrowRight } from "lucide-react";

export function HeroSection() {
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
                AI-Powered Resume Optimization
              </span>
            </div>
          </div>

          {/* Hero Title */}
          <h1 className="text-center mb-6 animate-slideUp">
            <span className="block text-foreground leading-tight mb-2">
              Land Your Dream Job
            </span>
            <span className="block bg-gradient-to-r from-mobile-cta via-primary to-secondary bg-clip-text text-transparent font-bold leading-tight">
              With AI-Optimized Resumes
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-center text-lg md:text-xl text-foreground/90 max-w-2xl mx-auto mb-8 leading-relaxed animate-slideUp delay-100">
            Get ATS-optimized resumes tailored to any job description. Increase your interview rate by up to 3x with professional AI assistance.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slideUp delay-200">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-mobile-cta-hover hover:bg-[hsl(142_76%_24%)] text-white shadow-xl shadow-mobile-cta/30 border-0 h-14 px-8 text-base font-semibold group"
            >
              <Link href={ROUTES.auth.signUp} className="flex items-center gap-2">
                Get Started Free
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
                See How It Works
              </Link>
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-foreground/75 animate-slideUp delay-300">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-mobile-cta to-secondary border-2 border-background flex items-center justify-center text-white font-bold text-xs"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>
                <strong className="text-foreground">2,847</strong> resumes optimized this week
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
                <strong className="text-foreground">4.9</strong> (1,234 reviews)
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
