import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { NewsletterSignup } from "@/components/newsletter-signup";

export async function Footer() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-border bg-background py-12">
      <div className="container px-4">
        {/* Newsletter Section */}
        <div className="max-w-2xl mx-auto mb-12 text-center">
          <h3 className="text-2xl font-bold mb-2">{t("newsletterTitle")}</h3>
          <p className="text-foreground/60 mb-6">{t("newsletterDescription")}</p>
          <NewsletterSignup />
          <p className="text-sm text-foreground/50 mt-4">
            {t.rich("newsletterNote", {
              link: (chunks) => (
                <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>

        {/* Footer Links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-border">
          <p className="text-sm text-foreground/60">{t("copyright", { year })}</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              {t("terms")}
            </Link>
            <Link href="/contact" className="text-foreground/60 hover:text-foreground transition-colors text-sm">
              {t("contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
