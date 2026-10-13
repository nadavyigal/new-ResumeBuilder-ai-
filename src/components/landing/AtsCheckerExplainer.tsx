// src/components/landing/AtsCheckerExplainer.tsx
import { getTranslations } from 'next-intl/server';

interface Measure {
  name: string;
  text: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface AtsCheckerExplainerProps {
  locale: string;
}

/**
 * What the Resumely Match Score is and is not, plus an FAQ.
 *
 * The FAQPage JSON-LD is built from the same strings that render on the page,
 * so the structured data can never claim something the visible copy does not.
 * Copy rules: the score is an estimate, never an employer's ATS score, and
 * nothing here promises interviews or outcomes.
 */
export async function AtsCheckerExplainer({ locale }: AtsCheckerExplainerProps) {
  const t = await getTranslations({ locale, namespace: 'atsCheckerPage.explainer' });
  const measures = t.raw('measures') as Measure[];
  const notMeasured = t.raw('not') as string[];
  const howToUse = t.raw('howToUse') as string[];
  const faq = t.raw('faq') as FaqItem[];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale === 'he' ? 'he-IL' : 'en-US',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <section className="py-16 border-t border-border">
      <div className="container px-4 mx-auto max-w-3xl space-y-12">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-lg text-foreground/80 leading-relaxed">{t('intro')}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t('measuresTitle')}</h3>
          <dl className="space-y-3">
            {measures.map(({ name, text }) => (
              <div key={name}>
                <dt className="font-semibold text-foreground">{name}</dt>
                <dd className="text-foreground/75 leading-relaxed">{text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t('notTitle')}</h3>
          <ul className="list-disc ps-6 space-y-2 text-foreground/75 leading-relaxed">
            {notMeasured.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t('howToUseTitle')}</h3>
          <ol className="list-decimal ps-6 space-y-2 text-foreground/75 leading-relaxed">
            {howToUse.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">{t('faqTitle')}</h3>
          <div className="divide-y divide-border border-y border-border">
            {faq.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer font-semibold text-foreground list-none flex justify-between gap-4">
                  {q}
                  <span aria-hidden="true" className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-foreground/75 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  );
}
