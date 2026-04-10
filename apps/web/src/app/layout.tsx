import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteUrl } from "@/lib/site-url";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

const appUrl = getSiteUrl();

export const metadata: Metadata = {
  title: {
    default: "PulsorClip",
    template: "%s | PulsorClip",
  },
  description:
    "PulsorClip by Adriel Zimbril. Self-hosted media inspection and export workspace with yt-dlp, ffmpeg, Telegram delivery, manual downloads, and authenticated cookie support.",
  metadataBase: new URL(appUrl),
  applicationName: "PulsorClip",
  authors: [{ name: "Adriel Zimbril", url: "https://www.adrielzimbril.com/" }],
  creator: "Adriel Zimbril",
  publisher: "Adriel Zimbril",
  category: "technology",
  alternates: {
    canonical: appUrl,
  },
  keywords: [
    "PulsorClip",
    "Adriel Zimbril",
    "self-hosted downloader",
    "yt-dlp",
    "Telegram bot",
    "media export workspace",
    "Next.js 16",
  ],
  openGraph: {
    title: "PulsorClip",
    description:
      "Inspect media URLs, prepare exports with yt-dlp and ffmpeg, and release manual downloads from a clean self-hosted workspace.",
    url: appUrl,
    siteName: "PulsorClip",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PulsorClip",
    description: "Self-hosted media inspection and export workflow by Adriel Zimbril.",
    creator: "@adrielzimbril",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
