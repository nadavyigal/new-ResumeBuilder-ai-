"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initPostHog, posthog } from '@/lib/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const utmCapturedRef = useRef(false);

  useEffect(() => {
    // Initialize PostHog once on mount
    initPostHog();
  }, []);

  useEffect(() => {
    // Capture UTM parameters on first visit
    if (utmCapturedRef.current) return;
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);

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

    utmCapturedRef.current = true;
  }, [pathname]);

  useEffect(() => {
    // Track pageviews on route change
    if (pathname && posthog && typeof window !== 'undefined') {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [pathname]);

  return <>{children}</>;
}

