import { logServer } from "../logger";
import type { FallbackHandler, FallbackMediaInfo, FallbackDownloadResult } from "../fallbacks";

/**
 * Twitter/X fallback using direct URL extraction
 */
export const twitterFallback: FallbackHandler = {
  name: "twitter_direct",
  priority: 20,
  canHandle: (url: string, platform: string) => platform === "twitter",
  fetchInfo: async (url: string, platform: string): Promise<FallbackMediaInfo> => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter fetch failed: ${response.status}`);
      }

      const html = await response.text();

      // Extract video URL from Twitter's embedded JSON
      const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
      const bitrateMatch = html.match(/"bitrate":(\d+)/);
      
      // Extract tweet text
      const tweetTextMatch = html.match(/"tweet_text":"([^"]+)"/);
      
      // Extract username
      const usernameMatch = html.match(/"screen_name":"([^"]+)"/);

      const resolvedUrl = videoUrlMatch?.[1];
      
      if (!resolvedUrl) {
        throw new Error("No video URL found in Twitter page");
      }

      // Decode URL
      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return {
        title: tweetTextMatch?.[1] || "Twitter Video",
        thumbnail: undefined,
        duration: null,
        uploader: usernameMatch?.[1] || "Twitter User",
        resolvedUrl: decodedUrl,
        resolvedVideoUrl: decodedUrl,
      };
    } catch (err) {
      logServer("warn", "fallbacks.twitter.fetch_failed", {
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
        throw new Error(`Twitter fetch failed: ${response.status}`);
      }

      const html = await response.text();
      const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);

      const resolvedUrl = videoUrlMatch?.[1];
      
      if (!resolvedUrl) {
        throw new Error("No video URL found");
      }

      const decodedUrl = resolvedUrl.replace(/\\/g, "").replace(/u0026/g, "&");

      return { success: true, resolvedUrl: decodedUrl };
    } catch (err) {
      logServer("warn", "fallbacks.twitter.download_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
