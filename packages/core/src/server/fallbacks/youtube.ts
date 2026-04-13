import { logServer } from "../logger";
import type {
  FallbackHandler,
  FallbackMediaInfo,
  FallbackDownloadResult,
} from "../fallbacks";

/**
 * YouTube fallback using Invidious instances
 * Invidious is an open-source YouTube frontend that provides direct video URLs
 */
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.snopyta.org",
  "https://yewtu.be",
  "https://invidious.kavin.rocks",
  "https://inv.riverside.rocks",
  "https://invidious.osi.kr",
  "https://invidious.namazso.eu",
  "https://inv.tux.pizza",
  "https://inv.citw.lgbt",
  "https://invidious.nerdvpn.de",
  "https://invidious.fdn.fr",
  "https://inv.bp.projectsegfau.lt",
  "https://invidious.privacydev.net",
  "https://invidious.perennialte.ch",
  "https://inv.mint.lgbt",
  "https://inv.pwoss.org",
];

function extractYouTubeVideoId(url: string): string | null {
  // Try to extract video ID from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

async function fetchFromInvidious(
  instance: string,
  videoId: string,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const apiUrl = `${instance}/api/v1/videos/${videoId}`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export const youtubeFallback: FallbackHandler = {
  name: "youtube_invidious",
  priority: 20, // Lower than Cobalt
  canHandle: (url: string, platform: string) => platform === "youtube",
  fetchInfo: async (
    url: string,
    platform: string,
  ): Promise<FallbackMediaInfo> => {
    try {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        throw new Error("Invalid YouTube URL");
      }

      let lastError: Error | null = null;

      // Try each instance
      for (const instance of INVIDIOUS_INSTANCES) {
        try {
          const data = await fetchFromInvidious(instance, videoId);

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
          lastError = err instanceof Error ? err : new Error(String(err));
          logServer("debug", "fallbacks.youtube.instance_failed", {
            instance,
            error: lastError.message,
          });
          continue;
        }
      }

      throw lastError || new Error("All Invidious instances failed");
    } catch (err) {
      logServer("warn", "fallbacks.youtube.fetch_failed", {
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
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        throw new Error("Invalid YouTube URL");
      }

      let lastError: Error | null = null;

      for (const instance of INVIDIOUS_INSTANCES) {
        try {
          const data = await fetchFromInvidious(instance, videoId);
          const bestStream = data.formatStreams?.[0]?.url;

          if (bestStream) {
            return { success: true, resolvedUrl: bestStream };
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          continue;
        }
      }

      throw lastError || new Error("No download URL found");
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
