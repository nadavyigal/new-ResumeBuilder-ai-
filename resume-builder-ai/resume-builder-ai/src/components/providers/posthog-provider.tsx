"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, posthog } from '@/lib/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize PostHog once on mount
    initPostHog();

    // Capture UTM parameters on first visit
    if (typeof window !== 'undefined' && searchParams) {
      const utmSource = searchParams.get('utm_source');
      const utmMedium = searchParams.get('utm_medium');
      const utmCampaign = searchParams.get('utm_campaign');
      const utmTerm = searchParams.get('utm_term');
      const utmContent = searchParams.get('utm_content');

      if (utmSource || utmMedium || utmCampaign) {
        const utmData = {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_term: utmTerm,
          utm_content: utmContent,
        };

        // Store in localStorage for later use
        localStorage.setItem('ph_utm_params', JSON.stringify(utmData));

        // Register as super properties
        posthog.register(utmData);
      }
    }
  }, []);

  useEffect(() => {
    // Track pageviews on route change
    if (pathname && posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}

