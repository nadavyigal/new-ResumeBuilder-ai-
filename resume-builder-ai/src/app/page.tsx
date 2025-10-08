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
              Skip the Blah, Bring the Boom
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
                We create content that
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Engages</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Gets people talking
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">🎯</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Converts</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Gets people clicking
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-4xl">🧠</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Stays</h3>
                <p className="text-foreground/70 leading-relaxed">
                  Gets people remembering
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className="py-16 lg:py-20">
          <div className="container px-4 mx-auto">
            <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">3x Sales in a day</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">The True Power of Words.</span> For Ilunios, our newsletters didn't just inform, they transformed. They skyrocketed engagement and translated into a staggering single-day sales surge.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">250% Increase in Engagement</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">We don't just plan, we play.</span> From clientacclaims like Lululemon's Instagram impressions like @JennyKeynotes and @LifeColoursLab a Instagram impressions blasting viral growth.
                </p>
              </div>

              <div className="rounded-3xl border-2 border-border bg-muted p-8 space-y-3">
                <h3 className="text-3xl font-bold text-foreground">175% Growth in Organic Search</h3>
                <p className="text-base text-foreground/60 leading-relaxed">
                  <span className="font-semibold">Because great content deserves to be found.</span> Mermer, JetSynthesys and Aylia Cocofelt/Colours a voice Google couldn't resist: keywords = creativity = results.
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
