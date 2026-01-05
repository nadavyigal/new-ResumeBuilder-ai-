"use client";

import { Linkedin, Twitter } from "@/lib/icons";
import { posthog } from "@/lib/posthog";
import { Button } from "@/components/ui/button";

export type SharePlatform = "linkedin" | "twitter";

interface SocialShareButtonProps {
  platform: SharePlatform;
  score: number;
}

const platformLabels: Record<SharePlatform, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter",
};

export function SocialShareButton({ platform, score }: SocialShareButtonProps) {
  const testId = platform === "linkedin" ? "share-linkedin" : "share-twitter";

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
        ? `I just checked my resume's ATS score - got ${score}/100. Check yours free at ${shareUrl}`
        : `My resume scored ${score}/100 on ATS compatibility. Check yours free at ${shareUrl}`;

    // Build share link
    const url =
      platform === "linkedin"
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(message)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "width=600,height=500");

    // Track share event
    posthog.capture("ats_checker_share_clicked", {
      platform,
      score,
      utm_campaign: 'ats-checker',
    });
  };

  return (
    <Button variant="outline" size="sm" data-testid={testId} onClick={handleShare}>
      {platform === "linkedin" ? (
        <Linkedin className="w-4 h-4 mr-2" />
      ) : (
        <Twitter className="w-4 h-4 mr-2" />
      )}
      Share on {platformLabels[platform]}
    </Button>
  );
}
