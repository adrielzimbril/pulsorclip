import { logServer } from "../logger";
import type {
  FallbackHandler,
  FallbackMediaInfo,
  FallbackDownloadResult,
} from "../fallbacks";

/**
 * Facebook fallback using direct URL extraction
 */
export const facebookFallback: FallbackHandler = {
  name: "facebook_direct",
  priority: 20,
  canHandle: (url: string, platform: string) => platform === "facebook",
  fetchInfo: async (
    url: string,
    platform: string,
  ): Promise<FallbackMediaInfo> => {
    try {
      // Try to fetch the page and extract video info
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Facebook fetch failed: ${response.status}`);
      }

      const html = await response.text();

      // Multiple patterns to extract video URL
      const patterns = [
        /"hd_src":"([^"]+)"/,
        /"sd_src":"([^"]+)"/,
        /"hd_url":"([^"]+)"/,
        /"sd_url":"([^"]+)"/,
        /"video_url":"([^"]+)"/,
        /"browser_native_hd_url":"([^"]+)"/,
        /"browser_native_sd_url":"([^"]+)"/,
        /href="https:\/\/[^"]+\.mp4[^"]*"/,
        /src="https:\/\/[^"]+\.mp4[^"]*"/,
      ];

      let resolvedUrl: string | null = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          resolvedUrl = match[1];
          break;
        }
      }

      // Extract title
      const titleMatch =
        html.match(/<title>([^<]+)<\/title>/) ||
        html.match(/<meta property="og:title" content="([^"]+)"/);

      // Extract thumbnail
      const thumbnailMatch = html.match(
        /<meta property="og:image" content="([^"]+)"/,
      );

      if (!resolvedUrl) {
        throw new Error("No video URL found in Facebook page");
      }

      // Decode URL if needed
      const decodedUrl = resolvedUrl
        .replace(/\\/g, "")
        .replace(/&amp;/g, "&")
        .replace(/u0026/g, "&");

      return {
        title: titleMatch?.[1] || "Facebook Video",
        thumbnail: thumbnailMatch?.[1]?.replace(/&amp;/g, "&"),
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
  getDownloadUrl: async (
    url: string,
    platform: string,
  ): Promise<FallbackDownloadResult> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Facebook fetch failed: ${response.status}`);
      }

      const html = await response.text();

      const patterns = [
        /"hd_src":"([^"]+)"/,
        /"sd_src":"([^"]+)"/,
        /"hd_url":"([^"]+)"/,
        /"sd_url":"([^"]+)"/,
        /"video_url":"([^"]+)"/,
        /"browser_native_hd_url":"([^"]+)"/,
        /"browser_native_sd_url":"([^"]+)"/,
      ];

      let resolvedUrl: string | null = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          resolvedUrl = match[1];
          break;
        }
      }

      if (!resolvedUrl) {
        throw new Error("No video URL found");
      }

      const decodedUrl = resolvedUrl
        .replace(/\\/g, "")
        .replace(/&amp;/g, "&")
        .replace(/u0026/g, "&");

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
