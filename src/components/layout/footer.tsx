export function Footer() {
  return (
    <footer className="border-t-2 border-border bg-background py-8">
      <div className="container px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-foreground/70 text-center md:text-left">
            © {new Date().getFullYear()} Resumely. Crafted with care.
          </p>
          <div className="flex flex-col items-center gap-3 text-sm text-foreground/70 md:flex-row md:gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}