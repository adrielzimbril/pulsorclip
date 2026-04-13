import { logServer } from "../logger";
import type {
  FallbackHandler,
  FallbackMediaInfo,
  FallbackDownloadResult,
} from "../fallbacks";

/**
 * Cobalt API fallback handler
 * Cobalt is a modern media processing API that supports multiple platforms
 */
const COBALT_INSTANCES = [
  "https://co.wuk.sh/api/json",
  "https://cobalt-api.kwiatekmiki.pl/api/json",
  "https://cobalt-api.nopecha.com/api/json",
  "https://cobalt-api.owo.rs/api/json",
];

async function fetchFromCobalt(
  url: string,
  platform: string,
  endpoint: string,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        vCodec: "h264",
        vQuality: "max",
        aFormat: "mp3",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `Cobalt API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    logServer("info", "fallbacks.cobalt.response", {
      platform,
      endpoint,
      status: data.status,
      hasUrl: !!data.url,
      hasAudio: !!data.audio,
    });

    if (data.status === "error" || data.status === "redirect") {
      throw new Error(`Cobalt error: ${data.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export const cobaltFallback: FallbackHandler = {
  name: "cobalt",
  priority: 10, // High priority as it's a reliable modern API
  canHandle: (url: string, platform: string) => {
    // Cobalt supports: YouTube, TikTok, Instagram, Twitter, Facebook, etc.
    const supportedPlatforms = [
      "youtube",
      "tiktok",
      "instagram",
      "twitter",
      "facebook",
      "threads",
    ];
    return supportedPlatforms.includes(platform);
  },
  fetchInfo: async (
    url: string,
    platform: string,
  ): Promise<FallbackMediaInfo> => {
    let lastError: Error | null = null;

    // Try each Cobalt instance
    for (const instance of COBALT_INSTANCES) {
      try {
        const data = await fetchFromCobalt(url, platform, instance);

        logServer("info", "fallbacks.cobalt.instance_success", {
          platform,
          instance,
          hasTitle: !!(data.filename || data.title),
          hasVideoUrl: !!data.url,
          hasAudioUrl: !!data.audio,
        });

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
        lastError = err instanceof Error ? err : new Error(String(err));
        logServer("warn", "fallbacks.cobalt.instance_failed", {
          platform,
          instance,
          error: lastError.message,
        });
        continue;
      }
    }

    // All instances failed
    logServer("warn", "fallbacks.cobalt.all_instances_failed", {
      platform,
      attemptedInstances: COBALT_INSTANCES,
      error: lastError?.message,
    });
    throw lastError || new Error("All Cobalt instances failed");
  },
  getDownloadUrl: async (
    url: string,
    platform: string,
  ): Promise<FallbackDownloadResult> => {
    let lastError: Error | null = null;

    for (const instance of COBALT_INSTANCES) {
      try {
        const data = await fetchFromCobalt(url, platform, instance);

        return {
          success: true,
          resolvedUrl: data.url || data.audio,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logServer("warn", "fallbacks.cobalt.download_instance_failed", {
          platform,
          instance,
          error: lastError.message,
        });
        continue;
      }
    }

    logServer("warn", "fallbacks.cobalt.download_all_failed", {
      platform,
      attemptedInstances: COBALT_INSTANCES,
      error: lastError?.message,
    });
    return {
      success: false,
      error: lastError?.message || "All Cobalt instances failed",
    };
  },
};
