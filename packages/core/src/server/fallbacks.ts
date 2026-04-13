import { logServer } from "./logger";

/**
 * Result interface for media fetching fallbacks
 */
export interface FallbackMediaInfo {
  title?: string;
  thumbnail?: string;
  duration?: number | null;
  uploader?: string;
  resolvedUrl?: string;
  resolvedVideoUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Result interface for download fallbacks
 */
export interface FallbackDownloadResult {
  success: boolean;
  resolvedUrl?: string;
  error?: string;
}

/**
 * Fallback handler interface
 */
export interface FallbackHandler {
  name: string;
  priority: number; // Lower = higher priority
  canHandle: (url: string, platform: string) => boolean;
  fetchInfo?: (url: string, platform: string) => Promise<FallbackMediaInfo>;
  getDownloadUrl?: (
    url: string,
    platform: string,
  ) => Promise<FallbackDownloadResult>;
}

/**
 * Execute fallbacks in priority order
 */
export async function executeFallbacks<T>(
  fallbacks: FallbackHandler[],
  url: string,
  platform: string,
  action: "fetchInfo" | "getDownloadUrl",
): Promise<T> {
  const sortedFallbacks = fallbacks
    .filter((fb) => fb.canHandle(url, platform))
    .sort((a, b) => a.priority - b.priority);

  logServer("info", "fallbacks.executing", {
    platform,
    url: url.substring(0, 100),
    availableFallbacks: sortedFallbacks.length,
    action,
  });

  for (const fallback of sortedFallbacks) {
    try {
      logServer("info", "fallbacks.attempting", {
        fallback: fallback.name,
        platform,
        action,
      });

      if (action === "fetchInfo" && fallback.fetchInfo) {
        const result = (await fallback.fetchInfo(url, platform)) as T;
        logServer("info", "fallbacks.success", {
          fallback: fallback.name,
          platform,
          action,
        });
        return result;
      } else if (action === "getDownloadUrl" && fallback.getDownloadUrl) {
        const result = (await fallback.getDownloadUrl(url, platform)) as T;
        logServer("info", "fallbacks.success", {
          fallback: fallback.name,
          platform,
          action,
        });
        return result;
      }
    } catch (err) {
      logServer("warn", "fallbacks.failed", {
        fallback: fallback.name,
        platform,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error(`No fallback succeeded for ${platform} - ${action}`);
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("facebook.com") || url.includes("fb.watch"))
    return "facebook";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("threads.net") || url.includes("threads.com"))
    return "threads";
  return "unknown";
}
