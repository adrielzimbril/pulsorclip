import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PulsorClip — Premium Media Downloader",
    short_name: "PulsorClip",
    description: "The most powerful self-hosted media download and export workspace. Save TikTok, Reels, Threads, and X media with one click.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/preview-light.png",
        sizes: "1200x630",
        type: "image/png",
        label: "PulsorClip Light Mode",
      },
      {
        src: "/preview-dark.png",
        sizes: "1200x630",
        type: "image/png",
        label: "PulsorClip Dark Mode",
      },
    ],
  };
}
