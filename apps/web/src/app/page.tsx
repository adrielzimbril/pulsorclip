import { ClipWorkbench } from "@/components/clip-workbench";
import { getRequestLocale } from "@/lib/request-locale";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const locale = await getRequestLocale();
  const params = await searchParams;
  const initialUrl = typeof params.url === "string" ? params.url : "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pulsorclip.adrielzimbril.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PulsorClip",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: baseUrl,
    creator: {
      "@type": "Person",
      name: "Adriel Zimbril",
      url: "https://www.adrielzimbril.com/",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "PulsorClip is a self-hosted media inspection and export workspace with manual downloads, Telegram delivery, yt-dlp, ffmpeg, and authenticated cookie support.",
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} type="application/ld+json" />
      <ClipWorkbench initialUrl={initialUrl} locale={locale} />
    </>
  );
}
