export function Footer() {
  return (
    <footer className="border-t-2 border-border bg-background py-8">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-foreground/60">
            © {new Date().getFullYear()} Resumely. Crafted with care.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Privacy
            </a>
            <a href="#" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Terms
            </a>
            <a href="#" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}