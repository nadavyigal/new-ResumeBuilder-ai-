import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PricingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.pricing" });
  return {
    title: t("title"),
    description: t("description")
  };
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricingPage" });

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <p className="inline-flex items-center rounded-full px-3 py-1 text-sm bg-secondary text-secondary-foreground mb-4">
          {t("badge")}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-foreground/70">{t("subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="text-2xl">{t("free.title")}</CardTitle>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{t("free.price")}</span>
              <span className="text-sm text-foreground/60">{t("free.period")}</span>
            </div>
            <CardDescription>{t("free.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>{t("free.feature1")}</p>
            <p>{t("free.feature2")}</p>
            <p>{t("free.feature3")}</p>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/auth/signup">{t("free.cta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">{t("premium.title")}</CardTitle>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{t("premium.price")}</span>
              <span className="text-sm text-foreground/60">{t("premium.period")}</span>
            </div>
            <CardDescription>{t("premium.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>{t("premium.feature1")}</p>
            <p>{t("premium.feature2")}</p>
            <p>{t("premium.feature3")}</p>
            <Button asChild className="w-full mt-4 bg-[hsl(216_65%_33%)] hover:bg-[hsl(216_65%_27%)] text-white">
              <Link href="/auth/signup">{t("premium.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-foreground/60 mt-8">{t("footnote")}</p>
    </div>
  );
}
