'use client';

import { useEffect, useState } from 'react';
import { posthog } from '@/lib/posthog';
import {
  CAMPAIGN_HANDOFF_EVENT,
  buildAppStoreUrl,
  handoffProperties,
  resolveCampaign,
  type CampaignContext,
} from '@/lib/campaign-context';

interface AppStoreCtaProps {
  label: string;
  locale: string;
  className?: string;
}

/**
 * The App Store link, campaign-aware.
 *
 * The href is resolved on the client because the campaign lives in the URL the
 * visitor arrived on, not in the route. Before hydration the link is the plain
 * organic URL, which is exactly what this page served previously, so a visitor
 * who clicks in that window is no worse off than before.
 *
 * The click emits `campaign_store_handoff` — a new, web-only event. It is not
 * an activation step and is never read as one: the governed funnel begins at
 * the iOS `resume_file_selected`, which this repository does not emit.
 */
export function AppStoreCta({ label, locale, className }: AppStoreCtaProps) {
  const [campaign, setCampaign] = useState<CampaignContext | null>(null);

  useEffect(() => {
    setCampaign(resolveCampaign(window.location.search));
  }, []);

  const href = buildAppStoreUrl(campaign?.campaign_id);

  const handleClick = () => {
    try {
      posthog.capture(CAMPAIGN_HANDOFF_EVENT, handoffProperties(campaign, locale));
    } catch {
      /* analytics must never block the store hop */
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-campaign-id={campaign?.campaign_id ?? ''}
      onClick={handleClick}
      className={className}
    >
      {label}
    </a>
  );
}
