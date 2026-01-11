import type { Metadata } from "next";
import { Geist, Geist_Mono, Heebo } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";
import { defaultLocale, locales, type Locale } from "@/locales";
import "./globals.css";

// Force dynamic rendering to fix build error
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = "force-no-store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://resumelybuilderai.com"),
  title: {
    default: "Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews",
    template: "%s | Resumely",
  },
  description:
    "Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds. Join 10,000+ professionals landing more interviews.",
  keywords: [
    "resume optimizer",
    "ATS resume checker",
    "AI resume builder",
    "resume scanner",
    "applicant tracking system",
    "resume optimization",
    "job application",
    "career tools",
    "ATS score",
    "resume tips",
  ],
  authors: [{ name: "Resumely Team" }],
  creator: "Resumely",
  publisher: "Resumely",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://resumelybuilderai.com",
    siteName: "Resumely",
    title: "Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews",
    description:
      "Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Resumely - AI Resume Optimizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resumely - AI Resume Optimizer | Beat ATS & Get 3X More Interviews",
    description:
      "Optimize your resume for any job with AI-powered insights. Get a 92% average ATS match score in 30 seconds.",
    images: ["/images/og-image.jpg"],
    creator: "@resumelyai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const headerLocale =
    requestHeaders.get("X-NEXT-INTL-LOCALE") ||
    requestHeaders.get("x-next-intl-locale");
  const resolvedLocale =
    headerLocale && locales.includes(headerLocale as Locale)
      ? (headerLocale as Locale)
      : defaultLocale;
  const dir = resolvedLocale === "he" ? "rtl" : "ltr";

  return (
    <html lang={resolvedLocale} dir={dir}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${heebo.variable} antialiased`}>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QEC1MEVSCW"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QEC1MEVSCW');
          `}
        </Script>

        <PostHogProvider>
          <AuthProvider>
            {children}
            <Toaster />
            <Analytics />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
