import { createNavigation } from 'next-intl/navigation';
import { defaultLocale, locales } from './locales';

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});
