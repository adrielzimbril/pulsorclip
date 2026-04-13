import { logServer } from "../logger";
import type {
  FallbackHandler,
  FallbackMediaInfo,
  FallbackDownloadResult,
} from "../fallbacks";

/**
 * YouTube fallback using Invidious instances and noembed API
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

  let matchedPattern: string | null = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      matchedPattern = pattern.source;
      logServer("info", "fallbacks.youtube.url_matched", {
        url: url.substring(0, 100),
        matchedPattern,
        videoId: match[1],
      });
      return match[1];
    }
  }

  logServer("warn", "fallbacks.youtube.no_pattern_matched", {
    url: url.substring(0, 100),
  });
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
    logServer("debug", "fallbacks.youtube.fetching_invidious", {
      instance,
      videoId,
      apiUrl,
    });

    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logServer("warn", "fallbacks.youtube.invidious_http_error", {
        instance,
        videoId,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    logServer("debug", "fallbacks.youtube.invidious_response", {
      instance,
      videoId,
      hasTitle: !!data.title,
      hasFormatStreams: !!data.formatStreams && data.formatStreams.length > 0,
      formatStreamsCount: data.formatStreams?.length || 0,
      hasAdaptiveFormats:
        !!data.adaptiveFormats && data.adaptiveFormats.length > 0,
      adaptiveFormatsCount: data.adaptiveFormats?.length || 0,
      isLive: data.liveNow || false,
    });

    return data;
  } catch (err) {
    clearTimeout(timeout);
    logServer("warn", "fallbacks.youtube.invidious_fetch_error", {
      instance,
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Fallback using noembed API (oEmbed for YouTube)
async function fetchFromNoembed(videoId: string): Promise<FallbackMediaInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const apiUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.title,
      thumbnail: data.thumbnail_url,
      duration: null, // noembed doesn't provide duration
      uploader: data.author_name,
      resolvedUrl: undefined,
      resolvedVideoUrl: undefined,
      width: undefined,
      height: undefined,
    };
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

      // Try each Invidious instance
      for (const instance of INVIDIOUS_INSTANCES) {
        try {
          const data = await fetchFromInvidious(instance, videoId);

          // Try formatStreams first, fallback to adaptiveFormats
          let formatUrl = data.formatStreams?.[0]?.url;

          // If no formatStreams, try adaptiveFormats (YouTube watch videos often use adaptiveFormats)
          if (
            !formatUrl &&
            data.adaptiveFormats &&
            data.adaptiveFormats.length > 0
          ) {
            // Try to find a video-only format (type: "video")
            const videoFormat = data.adaptiveFormats.find(
              (f: any) => f.type === "video",
            );
            if (videoFormat) {
              formatUrl = videoFormat.url;
            } else {
              // Fallback to first adaptive format
              formatUrl = data.adaptiveFormats[0].url;
            }
          }

          logServer("info", "fallbacks.youtube.invidious_success", {
            instance,
            videoId,
            hasTitle: !!data.title,
            hasFormatStreams:
              !!data.formatStreams && data.formatStreams.length > 0,
            hasAdaptiveFormats:
              !!data.adaptiveFormats && data.adaptiveFormats.length > 0,
            hasResolvedUrl: !!formatUrl,
            usedFormatStreams: !!data.formatStreams?.[0]?.url,
            usedAdaptiveFormats: !!data.adaptiveFormats?.[0]?.url,
            adaptiveFormatsCount: data.adaptiveFormats?.length || 0,
          });

          return {
            title: data.title,
            thumbnail: data.videoThumbnails?.[0]?.url,
            duration: data.lengthSeconds,
            uploader: data.author,
            resolvedUrl: formatUrl,
            resolvedVideoUrl: formatUrl,
            width: data.width,
            height: data.height,
          };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          logServer("debug", "fallbacks.youtube.invidious_instance_failed", {
            instance,
            error: lastError.message,
          });
          continue;
        }
      }

      // If all Invidious instances failed, try noembed as last resort
      logServer("info", "fallbacks.youtube.trying_noembed", { videoId });
      try {
        const result = await fetchFromNoembed(videoId);
        logServer("info", "fallbacks.youtube.noembed_success", {
          videoId,
          hasTitle: !!result.title,
          hasThumbnail: !!result.thumbnail,
        });
        return result;
      } catch (noembedErr) {
        logServer("warn", "fallbacks.youtube.noembed_failed", {
          error:
            noembedErr instanceof Error
              ? noembedErr.message
              : String(noembedErr),
        });
      }

      logServer("error", "fallbacks.youtube.all_failed", {
        attemptedInvidiousInstances: INVIDIOUS_INSTANCES,
        triedNoembed: true,
        lastError: lastError?.message,
      });

      throw lastError || new Error("All YouTube fallbacks failed");
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
