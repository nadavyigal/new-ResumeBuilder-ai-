"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

export function LocaleHtmlSync() {
  const locale = useLocale();

  useEffect(() => {
    const dir = locale === "he" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  return null;
}
