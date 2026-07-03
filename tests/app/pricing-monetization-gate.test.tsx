import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('next-intl/server', () => ({
  __esModule: true,
  getTranslations: async ({ namespace }: { namespace: string }) => (
    key: string
  ) => `${namespace}.${key}`,
}));

jest.mock('@/navigation', () => ({
  __esModule: true,
  Link: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)}>{children}</a>
  ),
}));

describe('pricing monetization gate', () => {
  it('renders Premium as unavailable instead of linking the upgrade CTA to signup', async () => {
    const { default: PricingPage } = require('@/app/[locale]/pricing/page');

    const html = renderToString(
      await PricingPage({ params: Promise.resolve({ locale: 'en' }) })
    );

    expect(html).toContain('pricingPage.premium.gatedCta');
    expect(html).toContain('pricingPage.premium.gatedNote');
    expect(html).not.toContain('pricingPage.premium.cta');
  });
});
