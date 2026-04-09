import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PulsorClip",
    short_name: "PulsorClip",
    description: "Self-hosted media inspection and export workspace by Adriel Zimbril.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f6",
    theme_color: "#111318",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
