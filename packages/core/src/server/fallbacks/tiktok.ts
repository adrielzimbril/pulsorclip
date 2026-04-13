import { logServer } from "../logger";
import type { FallbackHandler, FallbackMediaInfo, FallbackDownloadResult } from "../fallbacks";

/**
 * TikTok fallback using TikWM API
 * TikWM is a reliable API for TikTok media extraction
 */
export const tiktokFallback: FallbackHandler = {
  name: "tiktok_tikwm",
  priority: 15, // Higher than Invidious, lower than Cobalt
  canHandle: (url: string, platform: string) => platform === "tiktok",
  fetchInfo: async (url: string, platform: string): Promise<FallbackMediaInfo> => {
    try {
      const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(tikwmUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`TikWM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 0 || !data.data) {
        throw new Error(`TikWM error: ${data.msg || 'Unknown error'}`);
      }

      const videoData = data.data;
      const videoUrl = videoData.play || videoData.wmplay;
      const musicUrl = videoData.music;

      return {
        title: videoData.title,
        thumbnail: videoData.cover,
        duration: videoData.duration,
        uploader: videoData.author?.nickname,
        resolvedUrl: musicUrl, // Audio URL
        resolvedVideoUrl: videoUrl, // Video URL
        width: videoData.width,
        height: videoData.height,
      };
    } catch (err) {
      logServer("warn", "fallbacks.tiktok.fetch_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
  getDownloadUrl: async (url: string, platform: string): Promise<FallbackDownloadResult> => {
    try {
      const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(tikwmUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`TikWM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 0 || !data.data) {
        throw new Error(`TikWM error: ${data.msg || 'Unknown error'}`);
      }

      const videoUrl = data.data.play || data.data.wmplay;

      return {
        success: true,
        resolvedUrl: videoUrl,
      };
    } catch (err) {
      logServer("warn", "fallbacks.tiktok.download_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
