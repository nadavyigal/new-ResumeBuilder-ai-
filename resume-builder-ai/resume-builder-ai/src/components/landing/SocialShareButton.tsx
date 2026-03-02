"use client";

import { useTranslations } from "next-intl";
import { Linkedin, Twitter } from "@/lib/icons";
import { posthog } from "@/lib/posthog";
import { ATS_CHECKER_EVENTS } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";

export type SharePlatform = "linkedin" | "twitter";

interface SocialShareButtonProps {
  platform: SharePlatform;
  score: number;
}

export function SocialShareButton({ platform, score }: SocialShareButtonProps) {
  const testId = platform === "linkedin" ? "share-linkedin" : "share-twitter";
  const t = useTranslations("landing.share");

  const handleShare = () => {
    if (typeof window === "undefined") return;

    // Build URL with UTM parameters for attribution tracking
    const origin = window.location.origin;
    const utmParams = new URLSearchParams({
      utm_source: platform,
      utm_medium: 'social',
      utm_campaign: 'ats-checker',
      utm_content: `score-${score}`,
    });

    const shareUrl = `${origin}?${utmParams.toString()}`;

    // Build platform-specific message with UTM-tracked URL
    const message =
      platform === "linkedin"
        ? t("messageLinkedIn", { score, url: shareUrl })
        : t("messageTwitter", { score, url: shareUrl });

    // Build share link
    const url =
      platform === "linkedin"
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(message)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "width=600,height=500");

    // Track share event
    posthog.capture(ATS_CHECKER_EVENTS.SHARE_CLICKED, {
      platform,
      score,
      utm_campaign: 'ats-checker',
    });
  };

  return (
    <Button variant="outline" size="sm" data-testid={testId} onClick={handleShare}>
      {platform === "linkedin" ? (
        <Linkedin className="w-4 h-4 me-2" />
      ) : (
        <Twitter className="w-4 h-4 me-2" />
      )}
      {t("label", { platform: t(`platform.${platform}`) })}
    </Button>
  );
}
