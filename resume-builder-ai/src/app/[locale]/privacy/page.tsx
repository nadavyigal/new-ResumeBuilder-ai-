import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Privacy Policy | Resumely',
  description: 'Privacy policy for Resumely - AI Resume Optimizer',
};

export default async function PrivacyPolicy() {
  const t = await getTranslations('privacy');

  const infoProvidedItems = t.raw('sections.infoCollect.provided.items') as string[];
  const infoAutoItems = t.raw('sections.infoCollect.automatic.items') as string[];
  const useInfoItems = t.raw('sections.useInfo.items') as string[];
  const securityItems = t.raw('sections.security.items') as string[];
  const analyticsItems = t.raw('sections.thirdParty.analytics.items') as Array<{
    name: string;
    description: string;
    url: string;
  }>;
  const coreItems = t.raw('sections.thirdParty.core.items') as Array<{
    name: string;
    description: string;
    url: string;
  }>;
  const rightsItems = t.raw('sections.rights.items') as string[];
  const cookiesItems = t.raw('sections.cookies.items') as string[];
  const gdprItems = t.raw('sections.gdpr.items') as string[];
  const ccpaItems = t.raw('sections.ccpa.items') as string[];
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

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.infoCollect.title')}</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.infoCollect.provided.title')}</h3>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {infoProvidedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.infoCollect.automatic.title')}</h3>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {infoAutoItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.useInfo.title')}</h2>
        <p className="mb-4">{t('sections.useInfo.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {useInfoItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.security.title')}</h2>
        <p className="mb-4">{t('sections.security.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {securityItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">{t('sections.security.outro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.thirdParty.title')}</h2>
        <p className="mb-4">{t('sections.thirdParty.intro')}</p>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.thirdParty.analytics.title')}</h3>
          <ul className="list-disc ps-6 mb-4 space-y-2">
            {analyticsItems.map((item) => (
              <li key={item.name}>
                <strong>{item.name}:</strong> {item.description}{' '}
                (<a href={item.url} className="text-blue-600 hover:underline">{t('sections.thirdParty.linkLabel')}</a>)
              </li>
            ))}
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">{t('sections.thirdParty.core.title')}</h3>
          <ul className="list-disc ps-6 mb-4 space-y-2">
            {coreItems.map((item) => (
              <li key={item.name}>
                <strong>{item.name}:</strong> {item.description}{' '}
                (<a href={item.url} className="text-blue-600 hover:underline">{t('sections.thirdParty.linkLabel')}</a>)
              </li>
            ))}
          </ul>
        </div>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.retention.title')}</h2>
        <p className="mb-6">{t('sections.retention.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.rights.title')}</h2>
        <p className="mb-4">{t('sections.rights.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {rightsItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">
          {t('sections.rights.contact')}{' '}
          <a href="mailto:resumebuilderaiteam@gmail.com" className="text-blue-600 hover:underline">
            resumebuilderaiteam@gmail.com
          </a>
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.cookies.title')}</h2>
        <p className="mb-4">{t('sections.cookies.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {cookiesItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">{t('sections.cookies.outro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.children.title')}</h2>
        <p className="mb-6">{t('sections.children.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.international.title')}</h2>
        <p className="mb-6">{t('sections.international.body')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.changes.title')}</h2>
        <p className="mb-6">{t('sections.changes.body')}</p>

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

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.gdpr.title')}</h2>
        <p className="mb-4">{t('sections.gdpr.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {gdprItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mb-6">{t('sections.gdpr.outro')}</p>

        <h2 className="text-2xl font-bold mt-8 mb-4">{t('sections.ccpa.title')}</h2>
        <p className="mb-4">{t('sections.ccpa.intro')}</p>
        <ul className="list-disc ps-6 mb-6 space-y-2">
          {ccpaItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-foreground/70">{t('closingNote')}</p>
        </div>
      </div>
    </div>
  );
}
