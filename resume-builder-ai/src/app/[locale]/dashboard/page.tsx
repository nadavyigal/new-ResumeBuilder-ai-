"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/navigation";
import { Upload, Palette, Briefcase, TrendingUp, Sparkles, CheckCircle } from "@/lib/icons";
import { ROUTES } from "@/lib/constants";
import { createClientComponentClient } from "@/lib/supabase";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard.home");
  const { user, loading } = useAuth();
  const [convertedScore, setConvertedScore] = useState<any | null>(null);
  const suggestionsCount = useMemo(() => {
    if (!convertedScore || !Array.isArray(convertedScore.ats_suggestions)) return 0;
    return convertedScore.ats_suggestions.length;
  }, [convertedScore]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClientComponentClient();
    const loadConvertedScore = async () => {
      const { data } = await supabase
        .from("anonymous_ats_scores")
        .select("ats_score, ats_suggestions, converted_at")
        .eq("user_id", user.id)
        .not("converted_at", "is", null)
        .order("converted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setConvertedScore(data);
      }
    };

    loadConvertedScore();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div>
          <div className="text-lg text-foreground/60">{t("loading")}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will be redirected by middleware
  }

  const displayName = user.user_metadata?.full_name || t("welcome.fallbackName");

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 md:py-12 pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-12">
          {/* Welcome Section - Mobile Optimized */}
          <div className="space-y-3 md:text-center">
            <div className="flex items-center gap-2 md:justify-center">
              <h1 className="text-2xl md:text-5xl font-bold text-foreground">
                {t("welcome.title", { name: displayName })}
              </h1>
              {user.user_metadata?.is_premium && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 border-0 hidden md:inline-flex">
                  <Sparkles className="w-3 h-3 me-1" />
                  {t("welcome.premium")}
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-xl text-foreground/70">
              {t("welcome.subtitle")}
            </p>
          </div>

          {convertedScore && (
            <Card className="border-2 border-mobile-cta/40 bg-mobile-cta/5">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border-2 border-border flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-mobile-cta" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg md:text-2xl">
                      {t("conversion.title", { score: convertedScore.ats_score })}
                    </CardTitle>
                    <CardDescription className="text-sm md:text-base">
                      {t("conversion.description", { count: suggestionsCount })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-mobile-cta hover:bg-mobile-cta-hover text-white">
                  <Link href={ROUTES.upload}>
                    {t("conversion.cta")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bento Grid - Quick Actions */}
          <div className="grid gap-3 md:gap-6 grid-cols-2 md:grid-cols-4 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(200px,auto)]">
            {/* Upload Resume - Large Card (spans 2 columns on mobile, 2 cols on desktop) */}
            <Card className="col-span-2 md:col-span-2 md:row-span-2 hover:shadow-lg transition-all duration-300 border-2 hover:border-mobile-cta/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-900/10 group cursor-pointer">
              <Link href={ROUTES.upload} className="block h-full">
                <CardHeader className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white border-2 border-border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 md:w-8 md:h-8 text-foreground" />
                    </div>
                    <CardTitle className="text-lg md:text-3xl mb-2 text-foreground">{t("actions.uploadTitle")}</CardTitle>
                    <CardDescription className="text-xs md:text-base text-foreground/70">
                      {t("actions.uploadDescription")}
                    </CardDescription>
                  </div>
                  <Button className="w-full md:w-auto mt-4 bg-mobile-cta hover:bg-mobile-cta-hover text-white">
                    {t("actions.getStarted")}
                  </Button>
                </CardHeader>
              </Link>
            </Card>

            {/* Browse Templates */}
            <Card className="col-span-1 md:col-span-1 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
              <Link href={ROUTES.templates} className="block h-full">
                <CardHeader className="h-full flex flex-col justify-between p-4 md:p-6">
                  <div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                      <Palette className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <CardTitle className="text-base md:text-xl">{t("actions.templatesTitle")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs md:text-sm mt-2">
                    {t("actions.templatesDescription")}
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            {/* Applications */}
            <Card className="col-span-1 md:col-span-1 hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-500/50">
              <Link href={ROUTES.dashboard + "/applications"} className="block h-full">
                <CardHeader className="h-full flex flex-col justify-between p-4 md:p-6">
                  <div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                      <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                    </div>
                    <CardTitle className="text-base md:text-xl">{t("actions.applicationsTitle")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs md:text-sm mt-2">
                    {t("actions.applicationsDescription")}
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            {/* Stats Card - Placeholder */}
            <Card className="col-span-2 md:col-span-2 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-900/10 border-2">
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardDescription className="text-xs mb-1">{t("stats.averageScoreLabel")}</CardDescription>
                    <CardTitle className="text-2xl md:text-4xl font-bold">--</CardTitle>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                  </div>
                </div>
                <CardDescription className="text-xs mt-2">
                  {t("stats.emptyHint")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* How It Works - Mobile Optimized */}
          <div className="bg-muted/50 rounded-2xl md:rounded-3xl p-6 md:p-12 border-2 border-border">
            <h2 className="text-xl md:text-3xl font-bold text-foreground mb-6 md:mb-8">
              {t("howItWorks.title")}
            </h2>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-3">
              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">{t("howItWorks.step1.title")}</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    {t("howItWorks.step1.description")}
                  </p>
                </div>
              </div>

              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  2
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">{t("howItWorks.step2.title")}</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    {t("howItWorks.step2.description")}
                  </p>
                </div>
              </div>

              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  3
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">{t("howItWorks.step3.title")}</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    {t("howItWorks.step3.description")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
