"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (nextLocale: "en" | "he") => {
    if (nextLocale === locale) return;
    router.push(pathname, { locale: nextLocale });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={locale === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchLocale("en")}
      >
        {compact ? "EN" : t("english")}
      </Button>
      <Button
        variant={locale === "he" ? "default" : "ghost"}
        size="sm"
        onClick={() => switchLocale("he")}
      >
        {compact ? "HE" : t("hebrew")}
      </Button>
    </div>
  );
}