"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/utils/format-distance";

interface RateLimitMessageProps {
  resetAt: Date;
}

export function RateLimitMessage({ resetAt }: RateLimitMessageProps) {
  const router = useRouter();
  const timeUntilReset = formatDistance(resetAt, new Date());

  return (
    <div data-testid="rate-limit-message" className="space-y-4 text-center">
      <div className="flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          You&apos;ve used your 5 free checks this week
        </h3>
        <p className="text-sm text-foreground/70">
          Resets in {timeUntilReset}. Sign up for unlimited checks and AI-powered fixes.
        </p>
      </div>
      <Button
        className="w-full bg-[hsl(142_76%_24%)] hover:bg-[hsl(142_76%_20%)] text-white"
        onClick={() => router.push("/auth/signup")}
      >
        Sign Up Free
      </Button>
    </div>
  );
}
