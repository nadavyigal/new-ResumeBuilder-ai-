import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FreeATSChecker } from "@/components/landing/FreeATSChecker";
import { FeaturesBento } from "@/components/landing/features-bento";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCta } from "@/components/landing/final-cta";
import { defaultLocale } from "@/locales";

const SITE_URL = "https://www.resumelybuilderai.com";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.home" });
  const pageUrl = locale === defaultLocale ? `${SITE_URL}/` : `${SITE_URL}/${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${SITE_URL}/`,
        he: `${SITE_URL}/he`,
        "x-default": `${SITE_URL}/`
      }
    }
  };
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  // Without this, server components below (Footer) render in the default locale on /he.
  setRequestLocale(locale);
  const localePath = locale === defaultLocale ? "" : `/${locale}`;
  const pageUrl = `${SITE_URL}${localePath}`;
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Resumely",
    url: SITE_URL,
    logo: `${SITE_URL}/images/og-image.jpg`,
    sameAs: []
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Resumely",
    url: pageUrl,
    inLanguage: locale === "he" ? "he-IL" : "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: `${pageUrl}/blog?query={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <FreeATSChecker />
        <FeaturesBento />
        <HowItWorks />
        <FinalCta />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </main>
      <Footer />
    </div>
  );
}
