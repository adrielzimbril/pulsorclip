import { logServer } from "../logger";
import type {
  FallbackHandler,
  FallbackMediaInfo,
  FallbackDownloadResult,
} from "../fallbacks";

/**
 * Instagram fallback using direct URL extraction
 */
export const instagramFallback: FallbackHandler = {
  name: "instagram_direct",
  priority: 20,
  canHandle: (url: string, platform: string) => platform === "instagram",
  fetchInfo: async (
    url: string,
    platform: string,
  ): Promise<FallbackMediaInfo> => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Instagram fetch failed: ${response.status}`);
      }

      const html = await response.text();

      // Extract video URL from Instagram's embedded JSON
      const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
      const displayUrlMatch = html.match(/"display_url":"([^"]+)"/);

      // Extract title/description
      const captionMatch = html.match(
        /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([^"]+)"\}\}\]\}/,
      );

      // Extract username
      const usernameMatch = html.match(/"username":"([^"]+)"/);

      const resolvedUrl = videoUrlMatch?.[1] || displayUrlMatch?.[1];

      if (!resolvedUrl) {
        throw new Error("No media URL found in Instagram page");
      }

      // Decode URL
      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return {
        title: captionMatch?.[1] || "Instagram Media",
        thumbnail: displayUrlMatch?.[1]
          ?.replace(/\\/g, "")
          .replace(/u0026/g, "&"),
        duration: null,
        uploader: usernameMatch?.[1] || "Instagram User",
        resolvedUrl: decodedUrl,
        resolvedVideoUrl: decodedUrl,
      };
    } catch (err) {
      logServer("warn", "fallbacks.instagram.fetch_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
  getDownloadUrl: async (
    url: string,
    platform: string,
  ): Promise<FallbackDownloadResult> => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Instagram fetch failed: ${response.status}`);
      }

      const html = await response.text();
      const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
      const displayUrlMatch = html.match(/"display_url":"([^"]+)"/);

      const resolvedUrl = videoUrlMatch?.[1] || displayUrlMatch?.[1];

      if (!resolvedUrl) {
        throw new Error("No media URL found");
      }

      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return { success: true, resolvedUrl: decodedUrl };
    } catch (err) {
      logServer("warn", "fallbacks.instagram.download_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
