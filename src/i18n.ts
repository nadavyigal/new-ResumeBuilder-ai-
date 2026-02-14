import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './locales';

function isLocale(value?: string): value is Locale {
  return !!value && locales.includes(value as Locale);
}

type Messages = Record<string, unknown>;

function mergeMessages(base: Messages, overrides: Messages): Messages {
  const result: Messages = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = mergeMessages(base[key] as Messages, value as Messages);
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function loadFunnelOverrides(locale: Locale): Promise<Messages> {
  try {
    return (await import(`./messages-overrides/funnel/${locale}.json`)).default as Messages;
  } catch {
    return {};
  }
}

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale;
  const messages = (await import(`./messages/${resolvedLocale}.json`)).default as Messages;
  const enOverrides = await loadFunnelOverrides(defaultLocale);

  if (resolvedLocale === 'he') {
    const fallback = (await import('./messages/en.json')).default as Messages;
    const localeOverrides = await loadFunnelOverrides(resolvedLocale);
    const fallbackWithOverrides = mergeMessages(fallback, enOverrides);
    const merged = mergeMessages(fallbackWithOverrides, messages);
    return {
      locale: resolvedLocale,
      messages: mergeMessages(merged, localeOverrides),
    };
  }

  const localeOverrides = await loadFunnelOverrides(resolvedLocale);
  const mergedWithEnOverrides = mergeMessages(messages, enOverrides);

  return {
    locale: resolvedLocale,
    messages: mergeMessages(mergedWithEnOverrides, localeOverrides),
  };
});
