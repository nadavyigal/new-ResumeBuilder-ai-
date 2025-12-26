"use client";

import { Loader2 } from "lucide-react";

const steps = [
  "Parsing your resume",
  "Extracting ATS keywords",
  "Scoring compatibility",
  "Generating improvements",
];

export function LoadingState() {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-6">
      <div className="w-16 h-16 rounded-full border-4 border-foreground/10 border-t-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Scoring your resume...</h3>
        <p className="text-sm text-foreground/60">This usually takes under a minute.</p>
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
