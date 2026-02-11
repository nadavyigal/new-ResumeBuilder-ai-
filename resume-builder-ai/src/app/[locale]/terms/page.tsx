import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';

export const metadata: Metadata = {
  title: 'Terms of Service | Resumely',
  description: 'Terms of service for Resumely - AI Resume Optimizer',
};

export default async function TermsOfService() {
  const t = await getTranslations('terms');

  const serviceItems = t.raw('sections.service.items') as string[];
  const accountItems = t.raw('sections.accounts.creation.items') as string[];
  const pricingItems = t.raw('sections.pricing.tiers.items') as string[];
  const paymentItems = t.raw('sections.pricing.payment.items') as string[];
  const acceptableItems = t.raw('sections.acceptableUse.items') as string[];
  const aiItems = t.raw('sections.aiContent.items') as string[];
  const liabilityItems = t.raw('sections.disclaimers.liability.items') as string[];
  const contactItems = t.raw('sections.contact.items') as Array<{
    label: string;
    value: string;
    href: string;
  }>;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">{t('title')}</h1>
      <div className="prose prose-lg max-w-none">
        <p className="text-foreground/70 mb-8">{t('lastUpdated')}</p>

        <p className="mb-6">{t('intro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.acceptance.title')}</h2>
        <p className="mb-6">{t('sections.acceptance.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.service.title')}</h2>
        <p className="mb-4">{t('sections.service.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {serviceItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">{t('sections.service.outro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.accounts.title')}</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.accounts.creation.title')}</h3>
        <p className="mb-4">{t('sections.accounts.creation.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {accountItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.accounts.termination.title')}</h3>
        <p className="mb-6">{t('sections.accounts.termination.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.pricing.title')}</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.pricing.tiers.title')}</h3>
        <div className="mb-6">
          <p className="mb-4">{t('sections.pricing.tiers.intro')}</p>
          <ul className="list-disc ps-6 mb-4 space-y-2">
            {pricingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.pricing.payment.title')}</h3>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {paymentItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.pricing.refund.title')}</h3>
        <p className="mb-6">{t('sections.pricing.refund.body')}</p>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.pricing.cancellation.title')}</h3>
        <p className="mb-6">{t('sections.pricing.cancellation.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.acceptableUse.title')}</h2>
        <p className="mb-4">{t('sections.acceptableUse.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {acceptableItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.intellectual.title')}</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.intellectual.yourContent.title')}</h3>
        <p className="mb-6">{t('sections.intellectual.yourContent.body')}</p>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.intellectual.ourProperty.title')}</h3>
        <p className="mb-6">{t('sections.intellectual.ourProperty.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.aiContent.title')}</h2>
        <p className="mb-4">{t('sections.aiContent.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {aiItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.disclaimers.title')}</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.disclaimers.asIs.title')}</h3>
        <p className="mb-6">{t('sections.disclaimers.asIs.body')}</p>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.disclaimers.employment.title')}</h3>
        <p className="mb-6">{t('sections.disclaimers.employment.body')}</p>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.disclaimers.liability.title')}</h3>
        <p className="mb-6">{t('sections.disclaimers.liability.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {liabilityItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">{t('sections.disclaimers.liability.outro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.indemnification.title')}</h2>
        <p className="mb-6">{t('sections.indemnification.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.privacy.title')}</h2>
        <p className="mb-6">
          {t('sections.privacy.body')}{' '}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            {t('sections.privacy.linkLabel')}
          </Link>
          .
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.thirdParty.title')}</h2>
        <p className="mb-6">{t('sections.thirdParty.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.changes.title')}</h2>
        <p className="mb-6">{t('sections.changes.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.governing.title')}</h2>
        <p className="mb-6">{t('sections.governing.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.severability.title')}</h2>
        <p className="mb-6">{t('sections.severability.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.entire.title')}</h2>
        <p className="mb-6">{t('sections.entire.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.contact.title')}</h2>
        <p className="mb-4">{t('sections.contact.intro')}</p>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
          {contactItems.map((item) => (
            <p key={item.label} className="mb-2">
              <strong>{item.label}:</strong>{' '}
              <a href={item.href} className="text-blue-600 hover:underline">
                {item.value}
              </a>
            </p>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <p className="font-semibold mb-2">{t('sections.acknowledgment.title')}</p>
          <p className="text-sm text-foreground/70">{t('sections.acknowledgment.body')}</p>
        </div>

        <p className="text-sm text-foreground/60 mt-8">{t('effectiveDate')}</p>
      </div>
    </div>
  );
}
