import { logServer } from "../logger";
import type { FallbackHandler, FallbackMediaInfo, FallbackDownloadResult } from "../fallbacks";

/**
 * YouTube fallback using Invidious instances
 * Invidious is an open-source YouTube frontend that provides direct video URLs
 */
export const youtubeFallback: FallbackHandler = {
  name: "youtube_invidious",
  priority: 20, // Lower than Cobalt
  canHandle: (url: string, platform: string) => platform === "youtube",
  fetchInfo: async (url: string, platform: string): Promise<FallbackMediaInfo> => {
    try {
      // List of Invidious instances
      const instances = [
        "https://inv.nadeko.net",
        "https://invidious.snopyta.org",
        "https://yewtu.be",
        "https://invidious.kavin.rocks",
      ];

      // Extract video ID
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch) {
        throw new Error("Invalid YouTube URL");
      }
      const videoId = videoIdMatch[1];

      // Try each instance
      for (const instance of instances) {
        try {
          const apiUrl = `${instance}/api/v1/videos/${videoId}`;
          const response = await fetch(apiUrl);

          if (!response.ok) continue;

          const data = await response.json();

          return {
            title: data.title,
            thumbnail: data.videoThumbnails?.[0]?.url,
            duration: data.lengthSeconds,
            uploader: data.author,
            resolvedUrl: data.formatStreams?.[0]?.url,
            resolvedVideoUrl: data.formatStreams?.[0]?.url,
            width: data.width,
            height: data.height,
          };
        } catch (err) {
          logServer("debug", "fallbacks.youtube.instance_failed", {
            instance,
            error: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }

      throw new Error("All Invidious instances failed");
    } catch (err) {
      logServer("warn", "fallbacks.youtube.fetch_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
  getDownloadUrl: async (url: string, platform: string): Promise<FallbackDownloadResult> => {
    try {
      const instances = [
        "https://inv.nadeko.net",
        "https://invidious.snopyta.org",
        "https://yewtu.be",
      ];

      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (!videoIdMatch) {
        throw new Error("Invalid YouTube URL");
      }
      const videoId = videoIdMatch[1];

      for (const instance of instances) {
        try {
          const apiUrl = `${instance}/api/v1/videos/${videoId}`;
          const response = await fetch(apiUrl);

          if (!response.ok) continue;

          const data = await response.json();
          const bestStream = data.formatStreams?.[0]?.url;

          if (bestStream) {
            return { success: true, resolvedUrl: bestStream };
          }
        } catch (err) {
          continue;
        }
      }

      throw new Error("No download URL found");
    } catch (err) {
      logServer("warn", "fallbacks.youtube.download_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
