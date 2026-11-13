# Quick Fixes for Critical Issues

## Fix 1: Blog Route Build Failure (IMMEDIATE)

### Option A: Disable Static Generation (Fastest - 2 minutes)

Edit `src/app/blog/[slug]/page.tsx`:

```typescript
// Add this at the top of the file, after imports
export const dynamic = 'force-dynamic';

// Remove or comment out the generateStaticParams function
/*
export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}
*/
```

### Option B: Fix Remark Processing (Better - 15 minutes)

Replace `src/lib/blog.ts` with async processing:

```typescript
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postsDirectory = path.join(process.cwd(), 'src/content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  author: string;
  coverImage?: string;
  readingTime: number;
  tags?: string[];
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // Use async process instead of processSync
    const processedContent = await remark()
      .use(html)
      .process(content);
    const contentHtml = processedContent.toString();

    // Calculate reading time (average 200 words per minute)
    const wordCount = content.split(/\s+/g).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      slug,
      title: data.title,
      date: data.date,
      excerpt: data.excerpt,
      content: contentHtml,
      author: data.author || 'Resumely Team',
      coverImage: data.coverImage,
      readingTime,
      tags: data.tags || [],
    };
  } catch (error) {
    console.error(`Error reading post ${slug}:`, error);
    return null;
  }
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const slugs = getAllPostSlugs();
  const posts = await Promise.all(
    slugs.map((slug) => getPostBySlug(slug))
  );

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}
```

Then update `src/app/blog/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getAllPostSlugs, getPostBySlug } from '@/lib/blog';
import { Metadata } from 'next';

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

// Rest of the file stays the same, but make sure all functions are async
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

  if (!post) {
    notFound();
  }

  // Rest of the component stays the same
  return (
    <article className="container max-w-4xl mx-auto px-4 py-12">
      {post.coverImage && (
        <div className="mb-8">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-foreground/60">
          <span>{post.author}</span>
          <span>•</span>
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span>•</span>
          <span>{post.readingTime} min read</span>
        </div>
      </header>

      <div
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-800"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
        <h3 className="text-2xl font-bold mb-4">Ready to optimize your resume?</h3>
        <p className="text-foreground/70 mb-6">
          Get your ATS score and personalized optimization suggestions in 30 seconds.
        </p>
        <a
          href="/auth/signup"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Free Optimization
        </a>
      </div>
    </article>
  );
}
```

---

## Fix 2: Install Missing Sentry Dependency

```bash
cd "c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai"

# Option A: Install Sentry
npm install @sentry/nextjs

# Option B: Remove Sentry files if not needed yet
rm sentry.client.config.ts
rm sentry.edge.config.ts
rm sentry.server.config.ts
```

---

## Fix 3: Database Type Inference (Requires Investigation)

### Quick Check

Run this command to see if types can be regenerated:

```bash
# Install Supabase CLI globally if not installed
npm install -g supabase

# Generate types from your live Supabase project
npx supabase gen types typescript --project-id brtdyamysfmctrhuankn > src/types/database-generated.ts
```

Then compare `database-generated.ts` with current `database.ts` to see if there are differences.

### Alternative: Check Supabase Client Version

The issue might be version mismatch. Check if upgrading helps:

```bash
npm update @supabase/supabase-js @supabase/ssr
```

---

## Fix 4: ExtractedJobData Type

Check the actual interface in `src/lib/scraper/jobExtractor.ts` and update the API code to match.

If the interface uses different property names, update `src/app/api/public/ats-check/route.ts` around lines 149-154.

---

## Fix 5: Buffer Type in Download Routes

### In `src/app/api/download/[id]/route.ts` (line 139)

Change:
```typescript
return new Response(fileBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${optimization.id}.pdf"`,
  },
});
```

To:
```typescript
return new Response(fileBuffer.buffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${optimization.id}.pdf"`,
  },
});
```

### In `src/app/api/optimizations/export/route.ts` (line 265)

Make the same change - add `.buffer` to the Buffer variable.

---

## Verify Fixes

After applying fixes, run:

```bash
# 1. Try build again
npm run build

# 2. If build succeeds, try TypeScript check
npx tsc --noEmit

# 3. If TypeScript has fewer errors, continue fixing remaining issues

# 4. Once all fixed, remove the safety flags from next.config.ts
```

---

## Emergency: Skip Blog Entirely

If you need to launch NOW and can't fix the blog, just delete it temporarily:

```bash
# Move blog directory out of app
mv "c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/src/app/blog" "c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/blog-backup"

# Remove blog library
mv "c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/src/lib/blog.ts" "c:/Users/nadav/OneDrive/מסמכים/AI/cursor/cursor playground/ResumeBuilder AI/resume-builder-ai/blog-backup/"

# Try build again
npm run build
```

This will allow deployment without the blog feature. You can add it back later.
