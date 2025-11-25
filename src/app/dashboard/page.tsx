"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 sm:py-12">
        <div className="max-w-6xl mx-auto space-y-10 sm:space-y-12">
          {/* Welcome Section */}
          <div className="text-center space-y-3 sm:space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Welcome back, {user.user_metadata?.full_name || 'there'}!
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-foreground/70">
              Ready to create your next winning resume?
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-3xl">📄</span>
                </div>
                <CardTitle className="text-xl">Upload Resume</CardTitle>
                <CardDescription className="text-base text-foreground/70">
                  Start by uploading your current resume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" size="lg">
                  <Link href={ROUTES.upload}>
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-3xl">🎨</span>
                </div>
                <CardTitle className="text-xl">Browse Templates</CardTitle>
                <CardDescription className="text-base text-foreground/70">
                  Choose from professional templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full" size="lg">
                  <Link href={ROUTES.templates}>
                    Explore
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-3xl">📊</span>
                </div>
                <CardTitle className="text-xl">Applications</CardTitle>
                <CardDescription className="text-base text-foreground/70">
                  Track your job applications and optimized resumes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full" size="lg">
                  <Link href={ROUTES.dashboard + "/applications"}>
                    View Applications
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* How It Works */}
          <div className="bg-muted rounded-3xl p-6 sm:p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 md:mb-8">
              How It Works
            </h2>
            <div className="grid gap-6 md:gap-8 md:grid-cols-3">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <h3 className="text-lg md:text-xl font-bold text-foreground">Upload Your Resume</h3>
                <p className="text-foreground/60 text-base">
                  Upload your current resume in PDF or Word format
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <h3 className="text-lg md:text-xl font-bold text-foreground">Add Job Description</h3>
                <p className="text-foreground/60 text-base">
                  Paste the job description you&apos;re applying for
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <h3 className="text-lg md:text-xl font-bold text-foreground">Get Optimized Resume</h3>
                <p className="text-foreground/60 text-base">
                  Receive your AI-optimized resume with match insights
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}