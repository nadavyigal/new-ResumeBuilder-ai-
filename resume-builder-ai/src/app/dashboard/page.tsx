"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Upload, Palette, Briefcase, History, TrendingUp, Sparkles } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div>
          <div className="text-lg text-foreground/60">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will be redirected by middleware
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 md:py-12 pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-12">
          {/* Welcome Section - Mobile Optimized */}
          <div className="space-y-3 md:text-center">
            <div className="flex items-center gap-2 md:justify-center">
              <h1 className="text-2xl md:text-5xl font-bold text-foreground">
                Welcome back, {user.user_metadata?.full_name || 'there'}!
              </h1>
              {user.user_metadata?.is_premium && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 border-0 hidden md:inline-flex">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-xl text-foreground/70">
              Ready to create your next winning resume?
            </p>
          </div>

          {/* Bento Grid - Quick Actions */}
          <div className="grid gap-3 md:gap-6 grid-cols-2 md:grid-cols-4 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(200px,auto)]">
            {/* Upload Resume - Large Card (spans 2 columns on mobile, 2 cols on desktop) */}
            <Card className="col-span-2 md:col-span-2 md:row-span-2 hover:shadow-lg transition-all duration-300 border-2 hover:border-mobile-cta/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-900/10 group cursor-pointer">
              <Link href={ROUTES.upload} className="block h-full">
                <CardHeader className="h-full flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-mobile-cta flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <CardTitle className="text-lg md:text-3xl mb-2">Upload Resume</CardTitle>
                    <CardDescription className="text-xs md:text-base">
                      Start by uploading your current resume to get AI-powered optimizations
                    </CardDescription>
                  </div>
                  <Button className="w-full md:w-auto mt-4 bg-mobile-cta hover:bg-mobile-cta-hover">
                    Get Started
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
                    <CardTitle className="text-base md:text-xl">Templates</CardTitle>
                  </div>
                  <CardDescription className="text-xs md:text-sm mt-2">
                    Professional designs
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
                    <CardTitle className="text-base md:text-xl">Applications</CardTitle>
                  </div>
                  <CardDescription className="text-xs md:text-sm mt-2">
                    Track your jobs
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            {/* History */}
            <Card className="col-span-1 md:col-span-2 hover:shadow-lg transition-all duration-300 border-2 hover:border-purple-500/50">
              <Link href={ROUTES.dashboard + "/history"} className="block h-full">
                <CardHeader className="h-full flex flex-row md:flex-col justify-between items-center md:items-start p-4 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <History className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base md:text-xl">Optimization History</CardTitle>
                      <CardDescription className="text-xs md:text-sm hidden md:block mt-1">
                        View all your past optimizations
                      </CardDescription>
                    </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-muted-foreground md:hidden" />
                </CardHeader>
              </Link>
            </Card>

            {/* Stats Card - Placeholder */}
            <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-900/10 border-2">
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardDescription className="text-xs mb-1">Average ATS Score</CardDescription>
                    <CardTitle className="text-2xl md:text-4xl font-bold">--</CardTitle>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                  </div>
                </div>
                <CardDescription className="text-xs mt-2">
                  Upload your first resume to see your score
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* How It Works - Mobile Optimized */}
          <div className="bg-muted/50 rounded-2xl md:rounded-3xl p-6 md:p-12 border-2 border-border">
            <h2 className="text-xl md:text-3xl font-bold text-foreground mb-6 md:mb-8">
              How It Works
            </h2>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-3">
              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">Upload Your Resume</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    Upload your current resume in PDF or Word format
                  </p>
                </div>
              </div>

              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  2
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">Add Job Description</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    Paste the job description you&apos;re applying for
                  </p>
                </div>
              </div>

              <div className="flex md:flex-col gap-4 md:gap-0 md:space-y-3">
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-mobile-cta text-white flex items-center justify-center font-bold text-lg md:text-xl">
                  3
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base md:text-xl font-bold text-foreground">Get Optimized Resume</h3>
                  <p className="text-sm md:text-base text-foreground/60">
                    Receive your AI-optimized resume with match insights
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