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
              AI-Powered Resume Optimization
              <span className="inline-block ml-2 text-6xl">✨</span>
            </h1>

            <p className="mt-6 text-xl leading-relaxed text-foreground/80 max-w-xl mx-auto font-medium">
              Transform your resume for any job. Get ATS-optimized resumes that get you interviews.
            </p>

            <div className="mt-10">
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.auth.signUp}>
                  Get Started Free
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 lg:py-20 bg-accent/30">
          <div className="container px-4 mx-auto">
            <div className="max-w-xl mx-auto mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
                Why Choose Our AI Resume Optimizer
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">🤖</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">AI-Powered</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Advanced AI analyzes job descriptions and optimizes your resume automatically
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">📊</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">ATS-Optimized</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Get match scores and keyword optimization to pass ATS systems
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">⚡</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Fast Results</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Generate optimized resumes in minutes with professional templates
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 lg:py-20">
          <div className="container px-4 mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-12 text-center">
              How It Works
            </h2>
            <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-4">
                <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xl">
                  1
                </div>
                <h3 className="text-2xl font-bold text-foreground">Upload Your Resume</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  Begin by uploading your current resume in PDF or Word format. Our system will instantly parse and analyze your professional experience, skills, and achievements to create a structured profile.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-4">
                <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xl">
                  2
                </div>
                <h3 className="text-2xl font-bold text-foreground">Add Job Description</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  Simply paste the job description you&apos;re applying for, and our AI will extract key requirements, desired skills, and important keywords to understand exactly what the employer is seeking.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-4">
                <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xl">
                  3
                </div>
                <h3 className="text-2xl font-bold text-foreground">Get Optimized Resume</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  Receive your professionally optimized resume tailored to the specific job, complete with ATS match insights, keyword optimization, and strategic improvements to maximize your chances of landing an interview.
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
