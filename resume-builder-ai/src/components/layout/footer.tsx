import { NewsletterSignup } from '@/components/newsletter-signup';

export function Footer() {
  return (
    <footer className="border-t-2 border-border bg-background py-12">
      <div className="container px-4">
        {/* Newsletter Section */}
        <div className="max-w-2xl mx-auto mb-12 text-center">
          <h3 className="text-2xl font-bold mb-2">Get Resume Tips & Career Insights</h3>
          <p className="text-foreground/60 mb-6">
            Join 10,000+ professionals getting weekly tips on ATS optimization, resume writing, and landing interviews.
          </p>
          <NewsletterSignup />
        </div>

        {/* Footer Links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-border">
          <p className="text-sm text-foreground/60">
            © {new Date().getFullYear()} Resumely. Crafted with care.
          </p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Privacy
            </a>
            <a href="/terms" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Terms
            </a>
            <a href="/contact" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}