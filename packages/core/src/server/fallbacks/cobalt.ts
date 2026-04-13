import { logServer } from "../logger";
import type { FallbackHandler, FallbackMediaInfo, FallbackDownloadResult } from "../fallbacks";

/**
 * Cobalt API fallback handler
 * Cobalt is a modern media processing API that supports multiple platforms
 */
export const cobaltFallback: FallbackHandler = {
  name: "cobalt",
  priority: 10, // High priority as it's a reliable modern API
  canHandle: (url: string, platform: string) => {
    // Cobalt supports: YouTube, TikTok, Instagram, Twitter, Facebook, etc.
    const supportedPlatforms = ["youtube", "tiktok", "instagram", "twitter", "facebook", "threads"];
    return supportedPlatforms.includes(platform);
  },
  fetchInfo: async (url: string, platform: string): Promise<FallbackMediaInfo> => {
    try {
      // Cobalt API endpoint
      const cobaltUrl = "https://co.wuk.sh/api/json";
      
      const response = await fetch(cobaltUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
          vCodec: "h264",
          vQuality: "max",
          aFormat: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`Cobalt API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      logServer("info", "fallbacks.cobalt.response", {
        platform,
        status: data.status,
        hasUrl: !!data.url,
        hasAudio: !!data.audio,
      });

      if (data.status === "error" || data.status === "redirect") {
        throw new Error(`Cobalt error: ${data.status}`);
      }

      return {
        title: data.filename || data.title,
        thumbnail: data.thumbnail,
        duration: null, // Cobalt doesn't always provide duration
        uploader: data.uploader,
        resolvedUrl: data.audio, // Audio URL
        resolvedVideoUrl: data.url, // Video URL
        width: data.width,
        height: data.height,
      };
    } catch (err) {
      logServer("warn", "fallbacks.cobalt.fetch_failed", {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
  getDownloadUrl: async (url: string, platform: string): Promise<FallbackDownloadResult> => {
    try {
      const cobaltUrl = "https://co.wuk.sh/api/json";
      
      const response = await fetch(cobaltUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
          vCodec: "h264",
          vQuality: "max",
          aFormat: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`Cobalt API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === "error" || data.status === "redirect") {
        throw new Error(`Cobalt error: ${data.status}`);
      }

      return {
        success: true,
        resolvedUrl: data.url || data.audio,
      };
    } catch (err) {
      logServer("warn", "fallbacks.cobalt.download_failed", {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
