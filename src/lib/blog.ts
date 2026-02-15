import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import { sanitizeBlogHtml } from './sanitize-html';
import { defaultLocale, locales, type Locale } from '@/locales';

const postsDirectory = path.join(process.cwd(), 'src/content/blog');

export interface BlogPost {
  slug: string;
  locale: Locale;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  author: string;
  coverImage?: string;
  readingTime: number;
  tags?: string[];
}

function getLocalePostsDirectory(locale: Locale) {
  return path.join(postsDirectory, locale);
}

function getLegacyPostPath(slug: string) {
  return path.join(postsDirectory, `${slug}.md`);
}

function getLocalePostPath(locale: Locale, slug: string) {
  return path.join(getLocalePostsDirectory(locale), `${slug}.md`);
}

function listLocaleSlugs(locale: Locale): string[] {
  const localeDir = getLocalePostsDirectory(locale);
  if (!fs.existsSync(localeDir)) {
    return [];
  }

  return fs.readdirSync(localeDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''));
}

function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

async function parsePostFile(fullPath: string, slug: string, locale: Locale): Promise<BlogPost | null> {
  try {
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // Convert markdown to HTML
    const processedContent = await remark()
      .use(html)
      .process(content);
    const contentHtml = sanitizeBlogHtml(processedContent.toString());

    // Calculate reading time (average 200 words per minute)
    const wordCount = content.split(/\s+/g).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      slug,
      locale,
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
    console.error(`Error reading post ${slug} (${locale}):`, error);
    return null;
  }
}

export async function getAllPosts(locale: Locale): Promise<BlogPost[]> {
  const localeSlugs = listLocaleSlugs(locale);
  const hasLocaleDirectory = fs.existsSync(getLocalePostsDirectory(locale));

  const slugs = hasLocaleDirectory || locale !== defaultLocale
    ? localeSlugs
    : [
      ...localeSlugs,
      ...fs.readdirSync(postsDirectory)
        .filter((fileName) => fileName.endsWith('.md'))
        .map((fileName) => fileName.replace(/\.md$/, ''))
    ];

  const uniqueSlugs = [...new Set(slugs)];

  const posts = await Promise.all(
    uniqueSlugs.map((slug) => getPostBySlug(slug, locale))
  );

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getPostBySlug(slug: string, locale: Locale): Promise<BlogPost | null> {
  const localePath = getLocalePostPath(locale, slug);
  const localePost = await parsePostFile(localePath, slug, locale);
  if (localePost) return localePost;

  if (locale === defaultLocale) {
    const legacyPath = getLegacyPostPath(slug);
    return parsePostFile(legacyPath, slug, locale);
  }

  return null;
}

export async function getLocalizedPostMap(): Promise<Record<Locale, BlogPost[]>> {
  const entries = await Promise.all(
    locales.map(async (locale) => [locale, await getAllPosts(locale)] as const)
  );

  const map: Partial<Record<Locale, BlogPost[]>> = {};
  for (const [locale, posts] of entries) {
    if (!isLocale(locale)) continue;
    map[locale] = posts;
  }

  return map as Record<Locale, BlogPost[]>;
}
