import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Force dynamic rendering to fix build error
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Resume Optimizer",
  description: "Optimize your resume for any job with AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
