// src/app/[locale]/ats-checker/page.tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppStoreCta } from '@/components/landing/AppStoreCta';
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
            {/* Campaign-aware: the store link carries the arriving campaign as
                Apple's `ct` token, defaulting to the previous organic value. */}
            <AppStoreCta
              label={t('button')}
              locale={locale}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors"
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
