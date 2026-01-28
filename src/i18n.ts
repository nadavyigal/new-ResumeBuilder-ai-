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

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale;
  const messages = (await import(`./messages/${resolvedLocale}.json`)).default as Messages;

  if (resolvedLocale === 'he') {
    const fallback = (await import('./messages/en.json')).default as Messages;
    return {
      locale: resolvedLocale,
      messages: mergeMessages(fallback, messages),
    };
  }

  return {
    locale: resolvedLocale,
    messages,
  };
});
