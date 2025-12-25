import { getAllPosts } from '@/lib/blog';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resume Tips & Career Insights | Resumely Blog',
  description: 'Learn how to beat ATS systems, optimize your resume, and land more interviews with AI-powered insights.',
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Resume Tips & Career Insights</h1>
        <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
          Expert advice on ATS optimization, resume writing, and landing your dream job.
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
                <img
                  src={post.coverImage}
                  alt={post.title}
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
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
                <span>•</span>
                <span>{post.readingTime} min read</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground/60">No blog posts yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
