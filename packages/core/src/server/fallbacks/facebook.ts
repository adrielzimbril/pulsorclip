import { logServer } from "../logger";
import type { FallbackHandler, FallbackMediaInfo, FallbackDownloadResult } from "../fallbacks";

/**
 * Facebook fallback using direct URL extraction
 */
export const facebookFallback: FallbackHandler = {
  name: "facebook_direct",
  priority: 20,
  canHandle: (url: string, platform: string) => platform === "facebook",
  fetchInfo: async (url: string, platform: string): Promise<FallbackMediaInfo> => {
    try {
      // Try to fetch the page and extract video info
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Facebook fetch failed: ${response.status}`);
      }

      const html = await response.text();

      // Extract video URL from SD URL
      const sdUrlMatch = html.match(/"sd_url":"([^"]+)"/);
      const hdUrlMatch = html.match(/"hd_url":"([^"]+)"/);
      
      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      
      // Extract video ID
      const videoIdMatch = url.match(/\/videos\/(\d+)/);

      const resolvedUrl = hdUrlMatch?.[1] || sdUrlMatch?.[1];
      
      if (!resolvedUrl) {
        throw new Error("No video URL found in Facebook page");
      }

      // Decode URL if needed
      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return {
        title: titleMatch?.[1] || "Facebook Video",
        thumbnail: undefined,
        duration: null,
        uploader: "Facebook",
        resolvedUrl: decodedUrl,
        resolvedVideoUrl: decodedUrl,
      };
    } catch (err) {
      logServer("warn", "fallbacks.facebook.fetch_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
  getDownloadUrl: async (url: string, platform: string): Promise<FallbackDownloadResult> => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Facebook fetch failed: ${response.status}`);
      }

      const html = await response.text();
      const sdUrlMatch = html.match(/"sd_url":"([^"]+)"/);
      const hdUrlMatch = html.match(/"hd_url":"([^"]+)"/);

      const resolvedUrl = hdUrlMatch?.[1] || sdUrlMatch?.[1];
      
      if (!resolvedUrl) {
        throw new Error("No video URL found");
      }

      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return { success: true, resolvedUrl: decodedUrl };
    } catch (err) {
      logServer("warn", "fallbacks.facebook.download_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
