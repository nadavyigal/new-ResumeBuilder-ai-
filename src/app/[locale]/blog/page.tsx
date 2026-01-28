import { getAllPosts } from '@/lib/blog';
import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/navigation';

export const metadata: Metadata = {
  title: 'Resume Tips & Career Insights | Resumely Blog',
  description: 'Learn how to beat ATS systems, optimize your resume, and land more interviews with AI-powered insights.',
};

export default async function BlogIndex() {
  const posts = await getAllPosts();
  const t = await getTranslations('blog.index');
  const locale = await getLocale();
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
        <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
      </header>

      {/* Blog Posts Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Featured Image */}
            {post.coverImage && (
              <div className="aspect-video overflow-hidden">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  width={800}
                  height={450}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                {post.title}
              </h2>
              <p className="text-foreground/70 mb-4 line-clamp-3">
                {post.excerpt}
              </p>
              <div className="flex items-center gap-3 text-sm text-foreground/60">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString(dateLocale, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
                <span>{'\u2022'}</span>
                <span>{t('readingTime', { minutes: post.readingTime })}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground/60">{t('emptyState')}</p>
        </div>
      )}
    </div>
  );
}
