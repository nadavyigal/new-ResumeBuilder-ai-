import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { type Locale } from '@/locales';

interface ContactPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.contact' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">{t('title')}</h1>

      <div className="space-y-6">
        <p className="text-lg text-foreground/70">
          {t('intro')}
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">{t('emailTitle')}</h2>
            <a
              href="mailto:resumebuilderaiteam@gmail.com"
              className="text-blue-600 hover:underline"
            >
              resumebuilderaiteam@gmail.com
            </a>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">{t('supportTitle')}</h2>
            <p className="text-foreground/70">
              {t('supportDescription')}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">{t('featureTitle')}</h2>
            <p className="text-foreground/70">
              {t('featureDescription')}
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">{t('quickLinksTitle')}</h3>
          <ul className="space-y-2">
            <li><Link href="/privacy" className="text-blue-600 hover:underline">{t('quickLinks.privacy')}</Link></li>
            <li><Link href="/terms" className="text-blue-600 hover:underline">{t('quickLinks.terms')}</Link></li>
            <li><Link href="/blog" className="text-blue-600 hover:underline">{t('quickLinks.blog')}</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
