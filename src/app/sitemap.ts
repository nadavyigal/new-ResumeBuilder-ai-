import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { defaultLocale, locales } from "@/locales";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://resumelybuilderai.com";

  const withLocale = (path: string, locale: string) => {
    if (locale === defaultLocale) return path;
    return `/${locale}${path}`;
  };

  const localizedPosts = await Promise.all(
    locales.map(async (locale) => [locale, await getAllPosts(locale)] as const)
  );

  const blogUrls = localizedPosts.flatMap(([locale, posts]) =>
    posts.map((post) => ({
      url: `${baseUrl}${withLocale(`/blog/${post.slug}`, locale)}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
  );

  // Static pages
  const staticPaths = [
    { path: "/", changeFrequency: "daily" as const, priority: 1 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/pricing", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/auth/signup", changeFrequency: "monthly" as const, priority: 0.9 },
    { path: "/auth/signin", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  const staticPages = locales.flatMap((locale) =>
    staticPaths.map(({ path, changeFrequency, priority }) => ({
      url: `${baseUrl}${withLocale(path, locale)}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    }))
  );

  return [...staticPages, ...blogUrls];
}
