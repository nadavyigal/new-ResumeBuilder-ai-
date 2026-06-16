// src/app/[locale]/ats-checker/page.tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FreeATSChecker } from '@/components/landing/FreeATSChecker';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface AtsCheckerPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AtsCheckerPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'atsCheckerPage.meta' });
  const baseUrl = 'https://resumelybuilderai.com';
  const pageUrl = locale === 'en'
    ? `${baseUrl}/ats-checker`
    : `${baseUrl}/${locale}/ats-checker`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: pageUrl,
      languages: {
        'en': `${baseUrl}/ats-checker`,
        'he': `${baseUrl}/he/ats-checker`,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: pageUrl,
      type: 'website',
    },
  };
}

export default async function AtsCheckerPage({ params }: AtsCheckerPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'atsCheckerPage.appStoreCta' });

  const APP_STORE_URL =
    'https://apps.apple.com/app/resume-ai-cv-builder/id6776752349?ct=web-ats&at=organic';

  return (
    <>
      <Header />
      <main>
        <FreeATSChecker />

        {/* App Store attribution CTA — shown below the checker */}
        <section className="py-12 bg-muted/30 border-t border-border">
          <div className="container px-4 mx-auto text-center max-w-xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('heading')}
            </h2>
            <p className="text-foreground/70 mb-6">
              {t('subheading')}
            </p>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors"
            >
              {t('button')}
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
