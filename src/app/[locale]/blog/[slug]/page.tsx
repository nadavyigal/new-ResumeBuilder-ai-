import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import DOMPurify from 'isomorphic-dompurify';
import Image from 'next/image';
import { Link } from '@/navigation';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: `${post.title} | Resumely Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.coverImage ? [post.coverImage] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : [],
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const t = await getTranslations('blog.post');
  const locale = await getLocale();
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US';

  if (!post) {
    notFound();
  }

  return (
    <article className="container max-w-4xl mx-auto px-4 py-12">
      {/* Featured Image */}
      {post.coverImage && (
        <div className="mb-8">
          <Image
            src={post.coverImage}
            alt={post.title}
            width={1200}
            height={630}
            sizes="100vw"
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-foreground/60">
          <span>{post.author}</span>
          <span>{'\u2022'}</span>
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString(dateLocale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>{'\u2022'}</span>
          <span>{t('readingTime', { minutes: post.readingTime })}</span>
        </div>
      </header>

      {/* Content */}
      <div
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-800"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(post.content, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'img'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class']
          })
        }}
      />

      {/* CTA Section */}
      <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <h3 className="text-2xl font-bold mb-4">{t('cta.title')}</h3>
        <p className="text-foreground/70 mb-6">
          {t('cta.description')}
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('cta.button')}
        </Link>
      </div>
    </article>
  );
}
