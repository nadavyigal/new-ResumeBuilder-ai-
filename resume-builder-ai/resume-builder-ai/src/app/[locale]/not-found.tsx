import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotFound() {
  const t = await getTranslations('errors.notFound');

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <Link href="/">{t('home')}</Link>
    </div>
  );
}
