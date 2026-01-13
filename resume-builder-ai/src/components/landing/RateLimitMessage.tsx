"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { AlertTriangle } from "@/lib/icons";
import { Button } from "@/components/ui/button";

interface RateLimitMessageProps {
  resetAt: Date;
}

export function RateLimitMessage({ resetAt }: RateLimitMessageProps) {
  const router = useRouter();
  const t = useTranslations("landing.rateLimit");
  const timeUntilReset = useMemo(() => {
    const diffMs = resetAt.getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
      return t("time.soon");
    }

    const minutes = Math.ceil(diffMs / (60 * 1000));
    if (minutes < 60) {
      return t("time.minutes", { count: minutes });
    }

    const hours = Math.ceil(minutes / 60);
    if (hours < 24) {
      return t("time.hours", { count: hours });
    }

    const days = Math.ceil(hours / 24);
    return t("time.days", { count: days });
  }, [resetAt, t]);

  return (
    <div data-testid="rate-limit-message" className="space-y-4 text-center">
      <div className="flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          {t("title")}
        </h3>
        <p className="text-sm text-foreground/70">
          {t("description", { time: timeUntilReset })}
        </p>
      </div>
      <Button
        className="w-full bg-[hsl(142_76%_24%)] hover:bg-[hsl(142_76%_20%)] text-white"
        onClick={() => router.push("/auth/signup")}
      >
        {t("cta")}
      </Button>
    </div>
  );
}
