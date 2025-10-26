import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container px-4 py-16 mx-auto lg:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl font-bold tracking-tight sm:text-7xl text-foreground leading-tight">
              Your Resume, Optimized
              <span className="inline-block ml-2 text-6xl">💥</span>
            </h1>

            <p className="mt-6 text-xl leading-relaxed text-foreground/80 max-w-xl mx-auto font-medium">
              Just killer resumes, tailored to perform.
            </p>

            <div className="mt-10">
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.auth.signUp}>
                  Get in Touch
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 lg:py-20 bg-accent/30">
          <div className="container px-4 mx-auto">
            <div className="max-w-xl mx-auto mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
                Resumes that get noticed
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">🤖</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">ATS-Friendly</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Optimized to pass automated screening systems
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">⚡</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Lightning Fast</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Get your optimized resume in seconds, not hours
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">🎯</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Job-Matched</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Tailored to each specific job description
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 lg:py-20">
          <div className="container px-4 mx-auto">
            <div className="max-w-xl mx-auto mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
                How it works
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">1. Upload</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">Drop in your resume.</span> Upload your existing resume and paste the job description you're targeting.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">2. Analyze</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">AI does the heavy lifting.</span> Our AI analyzes your resume against the job requirements and identifies gaps and opportunities.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">3. Download</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">Get your optimized resume.</span> Download a perfectly formatted, ATS-friendly resume tailored to your target job.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
