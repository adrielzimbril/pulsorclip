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
    "PulsorClip by Adriel Zimbril. Self-hosted media download and export workspace with yt-dlp, ffmpeg, Telegram delivery, manual downloads, and authenticated cookie support.",
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
    "tiktok downloader",
    "tiktok video saver",
    "tiktok music extractor",
    "tiktok mp3 downloader",
    "threads downloader",
    "threads video saver",
    "threads image gallery",
    "instagram reels downloader",
    "reels saver",
    "twitter video downloader",
    "x video saver",
    "youtube downloader",
    "yt-dlp web UI",
    "ffmpeg media export",
    "self-hosted downloader",
    "telegram media bot",
    "cobalt alternative",
    "download music from tiktok",
    "save tiktok without watermark",
    "fast media downloader",
    "secure file exporter",
    "web-based yt-dlp",
  ],
  openGraph: {
    title: "PulsorClip",
    description:
      "Download media with yt-dlp and ffmpeg, then release manual downloads from a clean self-hosted workspace.",
    url: appUrl,
    siteName: "PulsorClip",
    images: [
      {
        url: "/preview-light.png",
        width: 1200,
        height: 630,
        alt: "PulsorClip — Premium Media Downloader",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PulsorClip",
    description: "Self-hosted media download and export workflow by Adriel Zimbril.",
    creator: "@adrielzimbril",
    images: ["/preview-light.png"],
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
  verification: {
    google: "google-site-verification-placeholder",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
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
