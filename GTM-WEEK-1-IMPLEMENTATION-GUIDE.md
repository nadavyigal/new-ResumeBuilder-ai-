# GTM Week 1 Implementation Guide
# Resume Builder AI - Execution Checklist

**Last Updated:** 2025-12-23
**Target:** Week 1 Day 3-4 Launch Readiness

---

## 🚨 CRITICAL BLOCKERS - FIX IMMEDIATELY

### 1. PostHog API Key Configuration ⏱️ 5 mins

**Status:** ✅ PARTIALLY COMPLETE (env vars added, need actual key)

**What's Done:**
- `.env.local` updated with PostHog placeholders

**What You Need to Do:**

1. **Get your PostHog API Key:**
   - Go to https://us.posthog.com/project/270848/settings/project
   - Log in with your PostHog account
   - Navigate to: Settings → Project → API Keys
   - Copy your "Project API Key"

2. **Update `.env.local`:**
   - Open: `resume-builder-ai\.env.local`
   - Replace `your_posthog_project_api_key` with your actual key
   - Should look like: `phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Verify PostHog is working:**
   ```bash
   cd resume-builder-ai
   npm run dev
   ```
   - Open http://localhost:3000
   - Open browser DevTools → Console
   - Look for PostHog initialization messages
   - Check PostHog dashboard for incoming events

**Expected Result:** PostHog should show live pageview events in your dashboard within 2-3 minutes.

---

### 2. Newsletter Database Table ⏱️ 3 mins

**Status:** ✅ MIGRATION CREATED (needs to be applied)

**What's Done:**
- SQL migration file created at `supabase/migrations/create_newsletter_subscribers.sql`

**What You Need to Do:**

1. **Apply the migration to Supabase:**

   **Option A: Using Supabase Dashboard (Recommended for beginners)**
   - Go to https://supabase.com/dashboard
   - Select your project: `brtdyamysfmctrhuankn`
   - Navigate to: SQL Editor
   - Click "New Query"
   - Copy-paste the contents of `supabase/migrations/create_newsletter_subscribers.sql`
   - Click "Run"
   - Verify in Table Editor that `newsletter_subscribers` table now exists

   **Option B: Using Supabase CLI (Advanced)**
   ```bash
   cd resume-builder-ai
   npx supabase db push
   ```

2. **Verify the table was created:**
   - Go to Supabase Dashboard → Table Editor
   - Look for `newsletter_subscribers` table
   - Should have columns: id, email, name, subscribed_at, status, created_at, updated_at

3. **Test email signup:**
   ```bash
   npm run dev
   ```
   - Open http://localhost:3000
   - Scroll to footer
   - Enter test email in newsletter form
   - Submit
   - Check Supabase Table Editor for new row
   - Check your email for welcome message

**Expected Result:** Newsletter signups work end-to-end (form → database → welcome email).

---

### 3. Email Service Verification ⏱️ 2 mins

**Status:** ✅ COMPLETE (Resend API key updated in .env.local)

**What You Need to Do:**

1. **Verify Resend Domain Setup:**
   - Go to https://resend.com/domains
   - Ensure `resumelybuilderai.com` is verified
   - Check DNS records are properly configured:
     - DKIM record (TXT)
     - SPF record (TXT)
     - DMARC record (TXT)

2. **Send Test Email:**
   ```bash
   cd resume-builder-ai
   npm run dev
   ```
   - Test newsletter signup with your email
   - Verify welcome email arrives
   - Check spam folder if not in inbox
   - Verify sender shows as: resumebuilderaiteam@gmail.com

3. **Update Email Confirmation Settings:**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Customize "Confirm signup" email template
   - Ensure "From" email is: resumebuilderaiteam@gmail.com

**Expected Result:** Welcome emails arrive in inbox within 1 minute of signup.

---

## 📝 BLOG INFRASTRUCTURE SETUP

### Step 1: Create Blog Directory Structure ⏱️ 10 mins

**What You Need to Do:**

1. **Create blog directories:**
   ```bash
   cd resume-builder-ai/src
   mkdir -p app/blog/[slug]
   mkdir -p content/blog
   ```

2. **Install required dependencies:**
   ```bash
   cd resume-builder-ai
   npm install gray-matter remark remark-html
   npm install -D @types/gray-matter
   ```

### Step 2: Create Blog Post Template

**File:** `resume-builder-ai/src/app/blog/[slug]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { Metadata } from 'next';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPostBySlug(params.slug);

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

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container max-w-4xl mx-auto px-4 py-12">
      {/* Featured Image */}
      {post.coverImage && (
        <div className="mb-8">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Header */}
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

      {/* Content */}
      <div
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-800"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* CTA Section */}
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

### Step 3: Create Blog Utilities

**File:** `resume-builder-ai/src/lib/blog.ts`

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

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPosts = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      return getPostBySlug(slug);
    })
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  return allPosts;
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // Convert markdown to HTML
    const processedContent = remark()
      .use(html)
      .processSync(content);
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
```

### Step 4: Create Blog Index Page

**File:** `resume-builder-ai/src/app/blog/page.tsx`

```typescript
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
```

### Step 5: Add Your First Blog Post

**File:** `resume-builder-ai/src/content/blog/how-to-beat-ats-systems-2025.md`

**Template Structure:**
```markdown
---
title: "How to Beat ATS Systems in 2025: The Complete Guide"
date: "2025-12-23"
excerpt: "Learn the proven strategies to optimize your resume for Applicant Tracking Systems and get 3x more interviews in 2025."
author: "Resumely Team"
coverImage: "/images/blog/ats-systems-2025.jpg"
tags: ["ATS", "Resume Optimization", "Job Search", "Career Tips"]
---

# How to Beat ATS Systems in 2025: The Complete Guide

[Your full blog post content here...]

## What is an ATS?

An Applicant Tracking System (ATS) is software used by 99% of Fortune 500 companies...

[Continue with your prepared content...]
```

**What You Need to Do:**

1. **Copy your prepared blog post:**
   - Take your existing "how-to-beat-ats-systems-2025.md" file
   - Add the frontmatter (metadata) at the top
   - Save it to: `resume-builder-ai/src/content/blog/how-to-beat-ats-systems-2025.md`

2. **Add a featured image:**
   - Find or create an image (1200x630px recommended)
   - Save it to: `resume-builder-ai/public/images/blog/ats-systems-2025.jpg`
   - Or use a free stock photo from Unsplash

3. **Test the blog locally:**
   ```bash
   cd resume-builder-ai
   npm run dev
   ```
   - Visit http://localhost:3000/blog
   - Click on your post
   - Verify formatting, images, and CTAs

---

## 🔍 SEO SETUP

### Step 1: Create Sitemap

**File:** `resume-builder-ai/src/app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://resumelybuilderai.com';

  // Get all blog posts
  const posts = getAllPosts();
  const blogUrls = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  return [...staticPages, ...blogUrls];
}
```

### Step 2: Create Robots.txt

**File:** `resume-builder-ai/src/app/robots.ts`

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/auth/'],
      },
    ],
    sitemap: 'https://resumelybuilderai.com/sitemap.xml',
  };
}
```

### Step 3: Enhance Root Metadata

**File:** `resume-builder-ai/src/app/layout.tsx` (update existing metadata)

**Replace the current metadata object with:**

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://resumelybuilderai.com'),
  title: {
    default: 'Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews',
    template: '%s | Resumely',
  },
  description: 'Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds. Join 10,000+ professionals landing more interviews.',
  keywords: [
    'resume optimizer',
    'ATS resume checker',
    'AI resume builder',
    'resume scanner',
    'applicant tracking system',
    'resume optimization',
    'job application',
    'career tools',
  ],
  authors: [{ name: 'Resumely Team' }],
  creator: 'Resumely',
  publisher: 'Resumely',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://resumelybuilderai.com',
    siteName: 'Resumely',
    title: 'Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews',
    description: 'Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds.',
    images: [
      {
        url: '/images/og-image.jpg', // You'll need to create this
        width: 1200,
        height: 630,
        alt: 'Resumely - AI Resume Optimizer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews',
    description: 'Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds.',
    images: ['/images/og-image.jpg'],
    creator: '@resumelyai', // Update with your actual Twitter handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Get from Google Search Console
  },
};
```

### Step 4: Submit to Google Search Console

**What You Need to Do:**

1. **Set up Google Search Console:**
   - Go to https://search.google.com/search-console
   - Click "Add Property"
   - Enter: `resumelybuilderai.com`
   - Choose verification method: "HTML tag" or "DNS record"

2. **Verify domain ownership:**
   - **Option A (HTML tag):** Add verification meta tag to layout.tsx
   - **Option B (DNS):** Add TXT record to your domain DNS

3. **Submit sitemap:**
   - After verification, go to Sitemaps section
   - Submit: `https://resumelybuilderai.com/sitemap.xml`
   - Google will start indexing your pages

4. **Request indexing for blog post:**
   - Use URL Inspection tool
   - Enter: `https://resumelybuilderai.com/blog/how-to-beat-ats-systems-2025`
   - Click "Request Indexing"
   - Google will prioritize crawling this URL

**Expected Timeline:**
- Sitemap submission: Immediate
- First crawl: 1-3 days
- Full indexing: 3-7 days
- Ranking: 2-4 weeks

---

## 📄 LEGAL PAGES (PRIVACY & TERMS)

### Quick Setup with TermsFeed

**What You Need to Do:**

1. **Generate Privacy Policy:**
   - Go to https://www.termsfeed.com/privacy-policy-generator/
   - Enter company info:
     - Website: resumelybuilderai.com
     - Company name: Resumely
     - Email: resumebuilderaiteam@gmail.com
   - Select services used:
     - Google Analytics
     - PostHog
     - Supabase (data storage)
     - Resend (email service)
     - OpenAI (AI processing)
   - Download HTML

2. **Generate Terms of Service:**
   - Go to https://www.termsfeed.com/terms-conditions-generator/
   - Enter company info
   - Select:
     - SaaS product
     - Freemium model ($9/month premium)
     - User-generated content (resumes)
   - Download HTML

3. **Create Privacy Page:**

**File:** `resume-builder-ai/src/app/privacy/page.tsx`

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Resumely - AI Resume Optimizer',
};

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-lg max-w-none">
        {/* Paste TermsFeed HTML here */}
        <p className="text-foreground/70">Last updated: December 23, 2025</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including:</p>
        <ul>
          <li>Account information (name, email address)</li>
          <li>Resume data (uploaded files and content)</li>
          <li>Job descriptions you input</li>
          <li>Payment information (processed securely via Stripe)</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and improve our AI resume optimization service</li>
          <li>Send you transactional emails and newsletters (with consent)</li>
          <li>Analyze usage patterns to improve our product</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Data Security</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul>
          <li>Encryption in transit (HTTPS/TLS)</li>
          <li>Encryption at rest for sensitive data</li>
          <li>Secure authentication via Supabase Auth</li>
          <li>Regular security audits</li>
        </ul>

        <h2>4. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li><strong>Google Analytics:</strong> Website analytics</li>
          <li><strong>PostHog:</strong> Product analytics</li>
          <li><strong>OpenAI:</strong> AI-powered resume optimization</li>
          <li><strong>Supabase:</strong> Database and authentication</li>
          <li><strong>Resend:</strong> Transactional email delivery</li>
          <li><strong>Stripe:</strong> Payment processing</li>
        </ul>

        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of marketing communications</li>
          <li>Export your data</li>
        </ul>

        <h2>6. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, contact us at:</p>
        <p>Email: resumebuilderaiteam@gmail.com</p>
      </div>
    </div>
  );
}
```

4. **Create Terms Page:**

**File:** `resume-builder-ai/src/app/terms/page.tsx`

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Resumely - AI Resume Optimizer',
};

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-lg max-w-none">
        {/* Paste TermsFeed HTML here */}
        <p className="text-foreground/70">Last updated: December 23, 2025</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using Resumely, you accept and agree to be bound by these Terms of Service.</p>

        <h2>2. Service Description</h2>
        <p>Resumely provides AI-powered resume optimization services including:</p>
        <ul>
          <li>ATS compatibility analysis</li>
          <li>Resume content suggestions</li>
          <li>Job description matching</li>
          <li>Professional resume templates</li>
        </ul>

        <h2>3. User Accounts</h2>
        <p>You are responsible for:</p>
        <ul>
          <li>Maintaining the security of your account</li>
          <li>All activities under your account</li>
          <li>Notifying us of unauthorized access</li>
        </ul>

        <h2>4. Subscription and Payments</h2>
        <p>Our pricing model:</p>
        <ul>
          <li><strong>Free Tier:</strong> 1 optimization per user</li>
          <li><strong>Premium:</strong> $9/month for unlimited optimizations and premium templates</li>
          <li>Payments processed securely via Stripe</li>
          <li>Subscriptions renew automatically unless cancelled</li>
          <li>Refunds available within 7 days of purchase</li>
        </ul>

        <h2>5. Acceptable Use</h2>
        <p>You agree NOT to:</p>
        <ul>
          <li>Use the service for illegal purposes</li>
          <li>Upload malicious content or viruses</li>
          <li>Attempt to reverse engineer our AI models</li>
          <li>Share your account credentials</li>
          <li>Scrape or automate access to our service</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>You retain all rights to your uploaded resume content. We retain rights to our AI models, software, and platform.</p>

        <h2>7. Disclaimer</h2>
        <p>Resumely provides suggestions and analysis but does not guarantee job interviews or employment outcomes.</p>

        <h2>8. Contact</h2>
        <p>For questions about these Terms, contact: resumebuilderaiteam@gmail.com</p>
      </div>
    </div>
  );
}
```

---

## 🎯 HERO SECTION VERIFICATION CHECKLIST

**What You Need to Do:**

1. **Visual Verification:**
   ```bash
   cd resume-builder-ai
   npm run dev
   ```
   - Open http://localhost:3000
   - Check desktop view (1920x1080)
   - Check mobile view (375x667)

2. **Content Verification:**
   - [ ] Hero headline: "Get 3X More Interviews With AI-Optimized Resumes"
   - [ ] Primary CTA: "Start Free Optimization"
   - [ ] Secondary CTA: "See How It Works"
   - [ ] Social proof: "10,000+ resumes optimized"
   - [ ] Stats: 92% match score, 3x interview rate

3. **Analytics Tracking:**
   - Open DevTools → Network tab
   - Click "Start Free Optimization"
   - Verify:
     - Google Analytics event fired
     - PostHog event captured (check PostHog dashboard)
     - Button redirects to /auth/signup

4. **Mobile Responsiveness:**
   - Open DevTools → Toggle device toolbar
   - Test on:
     - iPhone SE (375px)
     - iPhone 12 Pro (390px)
     - iPad (768px)
   - Verify:
     - Text is readable
     - Buttons are tap-friendly (min 44x44px)
     - Images load properly
     - No horizontal scroll

5. **Performance Check:**
   - Run Lighthouse audit in Chrome DevTools
   - Target scores:
     - Performance: >90
     - Accessibility: >95
     - Best Practices: >90
     - SEO: >90

---

## 📧 EMAIL WELCOME SEQUENCE SETUP

**Using Buttondown (Your Account Setup)**

1. **Log into Buttondown:**
   - Go to https://buttondown.email/
   - Verify your account is active

2. **Create Welcome Automation:**
   - Go to Automations
   - Create "New Subscriber" trigger
   - Add 3-email sequence:

**Email 1 (Immediate):** Welcome + Free Resource
```
Subject: Welcome to Resumely! Here's your free ATS guide 🎯

Hi [NAME],

Welcome to the Resumely community! You've just joined 10,000+ professionals who are landing more interviews with AI-optimized resumes.

As a thank you, here's your free guide: "The 7 ATS Mistakes Killing Your Job Applications"

[Download Free Guide]

In the next few days, I'll share:
- My proven 3-step resume optimization framework
- Real examples of before/after optimizations
- Exclusive tips from hiring managers

To your success,
The Resumely Team

P.S. Have a resume you want optimized? Start your free optimization here: [LINK]
```

**Email 2 (Day 3):** Education + Value
```
Subject: The #1 reason your resume gets rejected (and how to fix it)

[NAME], quick question:

Did you know 75% of resumes are rejected by ATS before a human ever sees them?

The culprit? Poor keyword optimization.

Here's what's happening:
[Explain ATS keyword matching...]

Read the full article: [Blog Link]

Want to see how your resume scores? Try our free ATS checker: [LINK]
```

**Email 3 (Day 7):** Social Proof + CTA
```
Subject: "I got 5 interviews in 2 weeks" - Sarah's resume transformation

[NAME],

Last week, Sarah used Resumely to optimize her marketing manager resume.

The results?
- ATS score: 38% → 94%
- Interviews: 0 → 5 in 2 weeks
- Job offer: Accepted!

Her secret? She followed our 3-step optimization process...

[Read Full Case Study]

Ready to get similar results? Start your free optimization: [LINK]

Questions? Just reply to this email.

Cheers,
The Resumely Team
```

3. **Import Existing Subscribers:**
   - Export from Resend/Supabase
   - Import to Buttondown
   - Tag as "existing_users"

---

## 🔗 LINKEDIN COMPANY PAGE SETUP

### Company Description (Pull from Homepage)

**Short Description (156 chars max):**
```
AI-powered resume optimizer. Beat ATS systems, increase your match score to 92%, and land 3X more interviews. Join 10,000+ professionals optimizing smarter.
```

**Long Description:**
```
Resumely is the AI-powered resume optimizer that helps job seekers beat Applicant Tracking Systems (ATS) and land more interviews.

Our platform analyzes your resume against any job description and provides personalized, AI-generated suggestions to increase your ATS match score. With an average score of 92%, our users get 3X more interview callbacks.

What We Offer:
✓ AI-Powered Resume Analysis
✓ Real-Time ATS Scoring
✓ Personalized Optimization Suggestions
✓ Professional ATS-Optimized Templates
✓ 30-Second Optimization Process

Whether you're actively job hunting or keeping your resume updated, Resumely ensures your application gets past the robots and into human hands.

Join 10,000+ professionals who've transformed their job search with Resumely.

Start optimizing for free: https://resumelybuilderai.com
```

### Required Information Checklist

- [ ] **Company Name:** Resumely
- [ ] **Tagline:** AI Resume Optimizer - Beat ATS & Get More Interviews
- [ ] **Website:** https://resumelybuilderai.com
- [ ] **Industry:** Technology, Information and Internet
- [ ] **Company Size:** 1-10 employees
- [ ] **Company Type:** Privately Held
- [ ] **Founded:** 2025
- [ ] **Specialties:** Resume Optimization, ATS Systems, AI Career Tools, Job Search, Interview Preparation

### Image Specifications

1. **Logo:**
   - Size: 300 x 300 pixels (square)
   - Format: PNG with transparent background
   - File size: <2MB
   - Background: White or transparent

2. **Cover Image:**
   - Size: 1128 x 191 pixels
   - Format: PNG or JPG
   - File size: <4MB
   - Recommended content: Hero image, product screenshot, or brand banner

3. **First Post Content:**
```
🚀 We're excited to launch Resumely - the AI-powered resume optimizer that helps you beat ATS systems and land more interviews!

75% of resumes never reach human eyes because they're filtered out by Applicant Tracking Systems. We're here to change that.

Our platform:
✓ Analyzes your resume against any job description
✓ Provides AI-powered optimization suggestions
✓ Gives you a real-time ATS match score
✓ Offers professional, ATS-optimized templates

The best part? You can optimize your first resume for FREE.

Join 10,000+ professionals who are landing more interviews with AI-optimized resumes.

👉 Try it free: https://resumelybuilderai.com

#ResumeOptimization #JobSearch #CareerDevelopment #AITools #ATS
```

---

## ✅ FINAL PRE-LAUNCH CHECKLIST

### Environment & Configuration
- [ ] PostHog API key configured in .env.local
- [ ] Resend API key verified (re_eLNmG5GV...)
- [ ] Google Analytics tracking verified
- [ ] Supabase connection working
- [ ] OpenAI API key valid

### Database
- [ ] newsletter_subscribers table created
- [ ] Test email signup works end-to-end
- [ ] Welcome email delivers successfully

### Pages & Content
- [ ] Landing page loads without errors
- [ ] Hero section displays correctly
- [ ] Newsletter signup in footer works
- [ ] Blog index page (/blog) displays
- [ ] First blog post published and accessible
- [ ] Privacy policy page created
- [ ] Terms of service page created

### SEO & Analytics
- [ ] Sitemap.xml generates correctly
- [ ] Robots.txt configured
- [ ] Open Graph metadata added
- [ ] Google Search Console verified
- [ ] Blog post submitted for indexing
- [ ] Analytics tracking verified

### Email & Communications
- [ ] Welcome email template tested
- [ ] Email domain verified in Resend
- [ ] Buttondown account ready (if using)
- [ ] DKIM/SPF records configured

### Marketing Setup
- [ ] LinkedIn company page created
- [ ] Company logo and cover image uploaded
- [ ] First LinkedIn post drafted
- [ ] Newsletter welcome sequence created

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deploy
1. **Test locally:**
   ```bash
   cd resume-builder-ai
   npm run build
   npm run start
   ```
   - Visit http://localhost:3000
   - Test all pages
   - Test email signup
   - Verify no build errors

2. **Update environment variables in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add:
     - NEXT_PUBLIC_POSTHOG_KEY
     - NEXT_PUBLIC_POSTHOG_HOST
     - RESEND_API_KEY (verify)
     - All other keys from .env.local

3. **Deploy to production:**
   ```bash
   git add .
   git commit -m "feat: add blog, newsletter, SEO improvements for GTM Week 1"
   git push origin main
   ```

### Post-Deploy Verification
- [ ] Visit https://resumelybuilderai.com
- [ ] Test hero section and CTAs
- [ ] Sign up for newsletter from footer
- [ ] Verify welcome email arrives
- [ ] Visit /blog page
- [ ] Read first blog post
- [ ] Check /privacy and /terms pages
- [ ] Run Lighthouse audit
- [ ] Check Google Analytics for pageviews
- [ ] Check PostHog for events

---

## 📊 WEEK 1 SUCCESS METRICS

Track these daily in a spreadsheet:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Blog pageviews | 100 | 0 | 🔴 |
| Newsletter signups | 50 | 0 | 🔴 |
| LinkedIn followers | 50 | 0 | 🔴 |
| Free signups | 10 | 0 | 🔴 |
| Blog indexed (Google) | Yes | No | 🔴 |
| GA4 tracking | Working | TBD | 🟡 |
| PostHog tracking | Working | TBD | 🟡 |

### How to Track:
1. **Blog pageviews:** Google Analytics → Realtime → Page views
2. **Newsletter signups:** Supabase → newsletter_subscribers table count
3. **LinkedIn followers:** LinkedIn Company Page → Analytics
4. **Free signups:** Supabase → profiles table count (new users)
5. **Blog indexed:** Google Search Console → Coverage report

---

## 🆘 TROUBLESHOOTING

### Newsletter Signup Not Working
1. Check browser console for errors
2. Verify RESEND_API_KEY in .env.local
3. Check Supabase newsletter_subscribers table exists
4. Test API endpoint: POST http://localhost:3000/api/newsletter/subscribe
5. Check Resend dashboard for failed emails

### PostHog Not Tracking
1. Verify NEXT_PUBLIC_POSTHOG_KEY is set
2. Check browser console for PostHog initialization
3. Disable ad blockers for testing
4. Check PostHog dashboard → Live Events
5. Verify PostHogProvider wraps the app

### Blog Not Showing
1. Verify blog posts exist in src/content/blog/
2. Check frontmatter format (valid YAML)
3. Verify gray-matter package installed
4. Check console for markdown parsing errors
5. Restart dev server

### Google Not Indexing Blog
1. Wait 3-7 days after sitemap submission
2. Use URL Inspection tool to force crawl
3. Ensure robots.txt allows /blog/
4. Check for noindex tags
5. Verify sitemap.xml is accessible

---

## 📞 NEED HELP?

**Priority Support Channels:**
1. Check this guide first
2. Google error messages
3. Check official docs:
   - Next.js: https://nextjs.org/docs
   - Supabase: https://supabase.com/docs
   - Resend: https://resend.com/docs
   - PostHog: https://posthog.com/docs

**Common Resources:**
- Next.js Blog Tutorial: https://nextjs.org/learn/basics/data-fetching/blog-data
- Supabase Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- Google Search Console: https://search.google.com/search-console/welcome

---

## ✨ NEXT STEPS AFTER WEEK 1

Once Week 1 is complete:

1. **Week 2 Focus:**
   - Launch premium pricing ($9/month)
   - Create 2-3 more blog posts
   - Start LinkedIn content calendar
   - Run first paid ads (optional)

2. **Content Calendar:**
   - Blog post every Monday
   - LinkedIn post 3x/week
   - Newsletter every Thursday

3. **Growth Tactics:**
   - Guest post on other career blogs
   - Comment on LinkedIn ATS discussions
   - Share blog posts in relevant Reddit communities
   - Engage with career coaches on Twitter

---

**Last Updated:** 2025-12-23
**Version:** 1.0.0

Good luck with your GTM Week 1 launch! 🚀
