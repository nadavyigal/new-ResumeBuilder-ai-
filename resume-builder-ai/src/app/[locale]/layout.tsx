import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleHtmlSync } from "@/components/LocaleHtmlSync";
import { locales, type Locale } from "@/locales";

const localeMetadata: Record<string, { title: string; description: string; locale: string }> = {
  en: {
    title: "Resumely | ATS Resume Checker and Optimization",
    description: "Check how ATS systems read your resume, fix high-impact blockers, and apply role-specific optimization.",
    locale: "en_US",
  },
  he: {
    title: "Resumely | בדיקת ATS וייעול קורות חיים",
    description: "בדקו איך מערכות ATS קוראות את קורות החיים שלכם, תקנו חסמים קריטיים וקבלו ייעול מותאם לתפקיד.",
    locale: "he_IL",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = localeMetadata[locale] ?? localeMetadata.en;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: meta.locale,
      alternateLocale: locale === "he" ? "en_US" : "he_IL",
      url: locale === "he" ? "https://resumelybuilderai.com/he" : "https://resumelybuilderai.com",
    },
    twitter: {
      title: meta.title,
      description: meta.description,
    },
    alternates: {
      canonical: locale === "he" ? "https://resumelybuilderai.com/he" : "https://resumelybuilderai.com",
      languages: {
        en: "https://resumelybuilderai.com",
        he: "https://resumelybuilderai.com/he",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <div lang={locale} dir={dir} className="min-h-screen">
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LocaleHtmlSync />
        <main id="main-content">
          {children}
        </main>
      </NextIntlClientProvider>
    </div>
  );
}
