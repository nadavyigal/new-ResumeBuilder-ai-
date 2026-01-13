'use client';

import { useTranslations } from 'next-intl';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{t('genericTitle')}</h1>
      <p>{error.message}</p>
      <button onClick={reset}>{t('tryAgain')}</button>
    </div>
  );
}
