import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LocaleHtmlSync } from "@/components/LocaleHtmlSync";
import { locales, type Locale } from "@/locales";

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
