import { randomUUID } from "node:crypto";
import {
  createWriteStream,
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { extname, join } from "node:path";
import { trackDownloadCompleted, trackDownloadCreated } from "./analytics";
import { appConfig, ensureAppDirs } from "./config";
import { logServer, stderrTail, urlForLogs } from "./logger";
import { runCommand } from "./process";
import { getStoredJob, getStoredJobs, getStoredQueue, writeStoredJob, writeStoredJobs, writeStoredQueue } from "./runtime-db";
import { getSourceProfile } from "./source-adapters";
import type {
  DownloadJob,
  DownloadRequestPayload,
  MediaInfo,
  MediaOption,
  PlaylistEntry,
} from "../shared/types";

declare global {
  var __pulsorclipJobs: Map<string, DownloadJob> | undefined;
  var __pulsorclipQueue: string[] | undefined;
  var __pulsorclipActiveJobId: string | null | undefined;
  var __pulsorclipActiveControllers: Map<string, AbortController> | undefined;
}

function getActiveControllers() {
  if (!global.__pulsorclipActiveControllers) {
    global.__pulsorclipActiveControllers = new Map<string, AbortController>();
  }
  return global.__pulsorclipActiveControllers;
}

function getJobs() {
  if (!global.__pulsorclipJobs) {
    global.__pulsorclipJobs = new Map<string, DownloadJob>(Object.entries(getStoredJobs()));
  }
  return global.__pulsorclipJobs;
}

function getQueue() {
  if (!global.__pulsorclipQueue) {
    global.__pulsorclipQueue = getStoredQueue();
  }
  return global.__pulsorclipQueue;
}

function getActiveJobId() {
  if (global.__pulsorclipActiveJobId === undefined) {
    global.__pulsorclipActiveJobId = null;
  }
  return global.__pulsorclipActiveJobId;
}

function setActiveJobId(id: string | null) {
  global.__pulsorclipActiveJobId = id;
}

const INFO_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 12 * 60_000;
const TRANSCODE_TIMEOUT_MS = 25 * 60_000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 90_000;
const TRANSCODE_IDLE_TIMEOUT_MS = 120_000;

function syncJobState(job?: DownloadJob) {
  if (job) {
    // Single job atomic update
    writeStoredJob(job);
  } else {
    // Queue update - ONLY update the queue table, NOT the jobs table
    // to prevent overwriting progress with stale memory data from other processes
    writeStoredQueue([...getQueue()]);
  }
}

function sanitizeFilename(input: string) {
  return input
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeUrl(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function normalizeMediaInfo(info: MediaInfo): MediaInfo {
  return {
    ...info,
    thumbnail: normalizeUrl(info.thumbnail) || "",
    images: info.images?.map((u) => normalizeUrl(u)).filter((u): u is string => !!u),
    resolvedUrl: normalizeUrl(info.resolvedUrl),
    resolvedVideoUrl: info.resolvedVideoUrl ? normalizeUrl(info.resolvedVideoUrl) : normalizeUrl(info.resolvedUrl),
    playlist: info.playlist
      ? {
          ...info.playlist,
          entries: info.playlist.entries
            .map((entry) => ({
              ...entry,
              thumbnail: normalizeUrl(entry.thumbnail),
            }))
            .filter((entry) => !!entry.url),
        }
      : undefined,
  };
}

function isYoutubePlaylistUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const hasList = parsed.searchParams.has("list");

    if (!hasList) {
      return false;
    }

    return (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("music.youtube.com")
    );
  } catch {
    return false;
  }
}

function resolvePlaylistEntryUrl(entry: Record<string, unknown>, playlistUrl: string) {
  const directUrl = typeof entry.url === "string" ? entry.url : null;

  if (directUrl?.startsWith("http")) {
    return directUrl;
  }

  if (typeof entry.webpage_url === "string" && entry.webpage_url.startsWith("http")) {
    return entry.webpage_url;
  }

  if (typeof entry.id === "string" && isYoutubePlaylistUrl(playlistUrl)) {
    try {
      const playlist = new URL(playlistUrl);
      const listId = playlist.searchParams.get("list");
      const watchUrl = new URL("https://www.youtube.com/watch");
      watchUrl.searchParams.set("v", entry.id);
      if (listId) {
        watchUrl.searchParams.set("list", listId);
      }
      return watchUrl.toString();
    } catch {
      return `https://www.youtube.com/watch?v=${entry.id}`;
    }
  }

  return null;
}

function extractPlaylistEntries(parsed: Record<string, unknown>, playlistUrl: string): PlaylistEntry[] {
  if (parsed._type !== "playlist" || !Array.isArray(parsed.entries)) {
    return [];
  }

  const entries = (parsed.entries as Record<string, unknown>[])
    .map<PlaylistEntry | null>((entry, index) => {
      const url = resolvePlaylistEntryUrl(entry, playlistUrl);

      if (!url) {
        return null;
      }

      return {
        id:
          (typeof entry.id === "string" && entry.id) ||
          `${index + 1}`,
        url,
        title: decodeHtmlEntities(
          typeof entry.title === "string" && entry.title.trim()
            ? entry.title
            : `Item ${index + 1}`,
        ),
        thumbnail: normalizeUrl(typeof entry.thumbnail === "string" ? entry.thumbnail : undefined),
        duration: typeof entry.duration === "number" ? entry.duration : null,
        uploader:
          typeof entry.uploader === "string" && entry.uploader.trim()
            ? decodeHtmlEntities(entry.uploader)
            : undefined,
      };
    });

  return entries.filter((entry): entry is PlaylistEntry => entry !== null);
}

function simplifyError(raw: string) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  // Search all lines (not just last) for known error patterns, then fallback to last line
  const allText = lines.join(" ");
  const lower = allText.toLowerCase();
  const lastLine = lines.at(-1) || raw.trim();

  if (!lastLine) {
    return "Unknown download error";
  }

  if (lower.includes("sign in to confirm you are not a bot") || lower.includes("login required")) {
    return "Authentication required. You must set YTDLP_COOKIES_BASE64 to download from this platform (especially for Stories).";
  }

  if (lower.includes("this story is no longer available") || lower.includes("story_unavailable")) {
    return "This story is no longer available or has expired.";
  }

  if (lower.includes("private") && (lower.includes("story") || lower.includes("instagram") || lower.includes("facebook"))) {
    return "This is a private story. You must provide valid cookies from an account that follows this user.";
  }

  // YouTube bot detection / sign-in required
  if (
    allText.includes("Sign in to confirm") ||
    allText.includes("not a bot") ||
    allText.includes("Precondition check failed") ||
    allText.includes("This video is age-restricted") ||
    allText.includes("confirm your age") ||
    allText.includes("LOGIN_REQUIRED")
  ) {
    return "YouTube requires authenticated cookies for this request on this server. Configure YTDLP_COOKIES_BASE64 in your environment variables.";
  }

  // YouTube video unavailable
  if (
    allText.includes("Video unavailable") ||
    allText.includes("This video is unavailable")
  ) {
    return "Video unavailable — it may be private, region-locked, or deleted.";
  }

  // Private / restricted
  if (
    allText.includes("Private") ||
    allText.includes("This is a private video")
  ) {
    return "Private or restricted media — cannot be accessed without authentication.";
  }

  // Unsupported URL
  if (
    allText.includes("Unsupported URL") ||
    allText.includes("is not a supported")
  ) {
    return "Unsupported URL — this platform or link type is not supported.";
  }

  // Instagram / Threads login
  if (
    allText.includes("login required") ||
    allText.includes("Please log in") ||
    allText.includes("checkpoint")
  ) {
    return "This platform requires authentication. Cookies are needed for private or restricted content.";
  }

  // Rate limiting / HTTP 429
  if (
    allText.includes("HTTP Error 429") ||
    allText.includes("Too Many Requests")
  ) {
    return "Rate limited by the platform. Try again in a few minutes.";
  }

  // Network / timeout
  if (
    allText.includes("Connection reset") ||
    allText.includes("timed out") ||
    allText.includes("Network is unreachable")
  ) {
    return "Network error — the server could not reach the media host. Try again.";
  }

  // Generic fallback: prioritize the last meaningful line, but include raw snippet if it looks like a system error
  return lastLine.length > 3 ? lastLine : `Extraction failed (Check Railway logs for raw stderr)`;
}

function updateJobProgress(
  job: DownloadJob,
  progress: number,
  progressLabel: string,
) {
  job.progress = Math.max(0, Math.min(100, Math.round(progress)));
  job.progressLabel = progressLabel;
  job.updatedAt = Date.now();
  syncJobState(job);
}

function parseProgressLine(job: DownloadJob, line: string) {
  const normalized = line.trim();

  if (!normalized) {
    return;
  }

  const percentMatch = normalized.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);

  if (percentMatch) {
    const percent = Number(percentMatch[1]);
    const scaled = Math.min(88, Math.max(3, percent * 0.88));
    updateJobProgress(job, scaled, normalized.replace(/\[download\]\s*/i, ""));
    return;
  }

  if (normalized.includes("[download] Destination:")) {
    updateJobProgress(job, 4, "Preparing source file");
    return;
  }

  if (normalized.includes("[Merger]")) {
    updateJobProgress(job, 90, "Merging source streams");
    return;
  }

  if (normalized.includes("[ExtractAudio]")) {
    updateJobProgress(job, 90, "Extracting source audio");
    return;
  }
}

function ensureCookieFileFromBase64() {
  if (!appConfig.ytDlpCookiesBase64) {
    return null;
  }

  const cookieDir = join(appConfig.downloadsDir, ".runtime");
  const cookieFile = join(cookieDir, "yt-cookies.txt");

  mkdirSync(cookieDir, { recursive: true });
  writeFileSync(
    cookieFile,
    Buffer.from(appConfig.ytDlpCookiesBase64, "base64"),
  );

  return cookieFile;
}

function getAuthArgs() {
  const args: string[] = [];

  if (appConfig.ytDlpCookiesFromBrowser) {
    args.push("--cookies-from-browser", appConfig.ytDlpCookiesFromBrowser);
  }

  if (appConfig.ytDlpCookiesFile) {
    args.push("--cookies", appConfig.ytDlpCookiesFile);
  } else {
    const base64File = ensureCookieFileFromBase64();

    if (base64File) {
      args.push("--cookies", base64File);
    }
  }

  return args;
}

function updateQueuePositions() {
  for (const job of getJobs().values()) {
    if (job.status === "queued") {
      const index = getQueue().indexOf(job.id);
      job.queuePosition = index >= 0 ? index + 1 : 1;
    } else {
      job.queuePosition = 0;
    }
  }
  syncJobState();
}

function getJobTempDir(jobId: string) {
  return join(appConfig.downloadsDir, `.tmp-${jobId}`);
}

function getTempOutputTemplate(jobId: string) {
  return join(getJobTempDir(jobId), "source.%(ext)s");
}

function getFinalOutputPath(jobId: string, ext: string) {
  return join(appConfig.downloadsDir, `${jobId}.${ext}`);
}

function isImageExt(ext: string) {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase());
}

function findPrimaryMediaFile(directory: string) {
  return (
    readdirSync(directory)
      .map((entry) => join(directory, entry))
      .filter(
        (filePath) =>
          !filePath.endsWith(".part") && statSync(filePath).isFile(),
      )
      .sort((left, right) => statSync(right).size - statSync(left).size)[0] ||
    null
  );
}

async function convertAudio(
  job: DownloadJob,
  sourcePath: string,
  outputPath: string,
  signal?: AbortSignal,
) {const codecArgs =
    job.targetExt === "mp3"
      ? ["-vn", "-c:a", "libmp3lame", "-b:a", "192k"]
      : ["-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"];

  const result = await runCommand(
    appConfig.ffmpegBin,
    [
      "-y",
      "-i",
      sourcePath,
      "-map",
      "0:a:0?",
      "-map_metadata",
      "0",
      "-metadata",
      `title=${job.title || "PulsorClip export"}`,
      ...codecArgs,
      outputPath,
    ],
    {
      timeoutMs: TRANSCODE_TIMEOUT_MS,
      idleTimeoutMs: TRANSCODE_IDLE_TIMEOUT_MS,
      idleTimeoutMessage: `Audio conversion stalled for ${Math.round(TRANSCODE_IDLE_TIMEOUT_MS / 1000)} seconds. Retry this file.`,
      signal,
      onStderrLine: (line) => {
        if (line.includes("time=") || line.includes("bitrate=")) {
          logServer("debug", "ffmpeg.audio.progress", { jobId: job.id, line: line.trim() });
        }
      },
    },
  );

  if (result.exitCode !== 0) {
    throw new Error(simplifyError(result.stderr));
  }
}

async function downloadDirectFile(
  job: DownloadJob,
  url: string,
  outputPath: string,
  signal?: AbortSignal,
) {
  updateJobProgress(job, 15, "Fetching high-speed media stream");
  logServer("info", "media.download.direct.started", { url: urlForLogs(url), outputPath });
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (url.includes("threads") || url.includes("cdninstagram")) {
    headers["Referer"] = "https://www.threads.net/";
  } else if (url.includes("tiktok") || url.includes("tikwm")) {
    headers["Referer"] = "https://www.tiktok.com/";
  }

  const response = await fetch(url, { headers, signal });

  if (!response.ok) {
    throw new Error(`Direct download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (!response.body) {
    throw new Error("Direct download failed: Response body is empty");
  }

  logServer("info", "media.download.direct.stream", { 
    url: urlForLogs(url), 
    contentLength: contentLength || "unknown" 
  });

  const writer = createWriteStream(outputPath);
  
  try {
    // In Node 22, pipeline natively supports Web Streams (ReadableStream).
    // We avoid using Readable.fromWeb explicitly to bypass potential ReferenceErrors
    // in environments where it might be misconfigured or polyfilled.
    // @ts-ignore
    await pipeline(response.body, writer, { signal });
  } catch (err) {
    writer.destroy();
    if (err instanceof Error && err.message.includes("require")) {
       throw new Error(`Direct download stream failure: Node runtime error (${err.message}). Check ESM/CJS compatibility.`);
    }
    throw err;
  }

  if (contentLength > 0) {
    const stats = statSync(outputPath);
    if (stats.size < contentLength) {
      throw new Error(`Direct download truncated: expected ${contentLength} bytes, got ${stats.size} bytes`);
    }
  }
}

async function convertVideo(
  job: DownloadJob,
  sourcePath: string,
  outputPath: string,
  signal?: AbortSignal,
) {const codecArgs =
    job.targetExt === "mp4"
      ? [
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "22",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
        ]
      : job.targetExt === "webm"
        ? [
            "-c:v",
            "libvpx-vp9",
            "-crf",
            "32",
            "-b:v",
            "0",
            "-c:a",
            "libopus",
            "-b:a",
            "160k",
          ]
        : ["-c", "copy"];

  const result = await runCommand(
    appConfig.ffmpegBin,
    [
      "-y",
      "-i",
      sourcePath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-map_metadata",
      "0",
      "-metadata",
      `title=${job.title || "PulsorClip export"}`,
      ...codecArgs,
      outputPath,
    ],
    {
      timeoutMs: TRANSCODE_TIMEOUT_MS,
      idleTimeoutMs: TRANSCODE_IDLE_TIMEOUT_MS,
      idleTimeoutMessage: `Video conversion stalled for ${Math.round(TRANSCODE_IDLE_TIMEOUT_MS / 1000)} seconds. Retry this file.`,
      signal,
      onStderrLine: (line) => {
        if (line.includes("frame=") || line.includes("fps=")) {
          logServer("debug", "ffmpeg.video.progress", { jobId: job.id, line: line.trim() });
        }
      },
    },
  );

  if (result.exitCode !== 0) {
    throw new Error(simplifyError(result.stderr));
  }
}

function pickVideoOptions(rawInfo: Record<string, unknown>) {
  const entries = new Map<string, MediaOption & { score: number }>();
  const formats = Array.isArray(rawInfo.formats) ? rawInfo.formats : [];

  for (const item of formats) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const current = item as Record<string, unknown>;
    const id = typeof current.format_id === "string" ? current.format_id : null;
    const height = Number(current.height || 0);
    const fps = Number(current.fps || 0) || undefined;
    const tbr = Number(current.tbr || 0);
    const vcodec = current.vcodec;
    const acodec = current.acodec;
    const ext =
      typeof current.ext === "string" ? current.ext.toLowerCase() : "";

    if (
      !id ||
      !height ||
      vcodec === "none" ||
      ext === "gif" ||
      ext === "jpg" ||
      ext === "png"
    ) {
      continue;
    }

    const key = `${height}-${fps || 0}`;
    const label = `${height}p${fps ? ` / ${fps}fps` : ""}`;
    const score = tbr + (acodec && acodec !== "none" ? 5_000 : 0);
    const existing = entries.get(key);

    if (!existing || score > existing.score) {
      entries.set(key, {
        id,
        label,
        ext,
        height,
        fps,
        qualityLabel: `${height}p`,
        score,
      });
    }
  }

  return [...entries.values()]
    .sort(
      (left, right) =>
        (right.height || 0) - (left.height || 0) ||
        (right.fps || 0) - (left.fps || 0) ||
        right.score - left.score,
    )
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      ext: entry.ext,
      height: entry.height,
      fps: entry.fps,
      qualityLabel: entry.qualityLabel,
    }));
}

function pickAudioOptions(rawInfo: Record<string, unknown>) {
  const entries = new Map<string, MediaOption & { score: number }>();
  const formats = Array.isArray(rawInfo.formats) ? rawInfo.formats : [];

  for (const item of formats) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const current = item as Record<string, unknown>;
    const id = typeof current.format_id === "string" ? current.format_id : null;
    const abr = Number(current.abr || 0);
    const ext = typeof current.ext === "string" ? current.ext : "m4a";
    const acodec = current.acodec;

    if (!id || !abr || acodec === "none") {
      continue;
    }

    const key = `${abr}`;
    const existing = entries.get(key);

    if (!existing || abr > existing.score) {
      entries.set(key, {
        id,
        label: `${abr}kbps`,
        ext,
        abr,
        qualityLabel: `${abr}kbps`,
        score: abr,
      });
    }
  }

  const audioOptions: MediaOption[] = [...entries.values()]
    .sort((left, right) => (right.abr || 0) - (left.abr || 0))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      ext: entry.ext,
      abr: entry.abr,
      qualityLabel: entry.qualityLabel,
    }));
  
  // High-priority fallback for TikTok standard videos to ensure Audio button appears
  if (audioOptions.length === 0 && rawInfo.webpage_url && (rawInfo.webpage_url as string).includes("tiktok.com")) {
    audioOptions.push({
      id: "bestaudio",
      label: "Best Audio",
      ext: "mp3",
      qualityLabel: "Best",
    });
  }

  return audioOptions;
}

export async function scrapeThreadsInfo(url: string): Promise<MediaInfo> {
  // Use .net for internal fetching consistently
  const fetchUrl = url.replace("threads.com", "threads.net");
  logServer("info", "media.info.scrape.threads.started", {
    url: urlForLogs(fetchUrl),
  });

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Threads fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    let resolvedUrl: string | undefined;

    // 1. Try to find all video versions in the JSON bootstrap and pick the best one
    const videoVersionsMatch = html.match(/"video_versions":\s*(\[.*?\])/i);
    if (videoVersionsMatch) {
      try {
        const versions = JSON.parse(videoVersionsMatch[1]
          .replace(/\\u0025/g, "%")
          .replace(/\\\//g, "/")
          .replace(/&amp;/g, "&")
        );
        if (Array.isArray(versions) && versions.length > 0) {
          // Sort by width/height if available, otherwise pick the first one which is usually higher quality than the thumbnail
          const sorted = versions.sort((a, b) => (b.width || 0) - (a.width || 0));
          resolvedUrl = sorted[0].url;
        }
      } catch (e) {
        // Fallback to simple match if JSON parse fails
      }
    }

    if (!resolvedUrl) {
      const jsonMatch = 
        html.match(/"video_url":\s*"([^"]+)"/i) ||
        html.match(/"video":\s*\{\s*"url":\s*"([^"]+)"/i);
      if (jsonMatch) {
        resolvedUrl = jsonMatch[1]
          .replace(/\\u0025/g, "%")
          .replace(/\\\//g, "/")
          .replace(/&amp;/g, "&");
      }
    }

    // 2. Fallback to OpenGraph meta tags if JSON fails
    if (!resolvedUrl) {
      const videoMatch =
        html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
        html.match(/<meta\s+name="twitter:player:stream"\s+content="([^"]+)"/i) ||
        html.match(/<meta\s+property="og:video:url"\s+content="([^"]+)"/i) ||
        html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i) ||
        html.match(/<video[^>]+src="([^"]+)"/i);
      if (videoMatch) {
        resolvedUrl = videoMatch[1].replace(/&amp;/g, "&");
      }
    }

    // 3. Try to find images and videos for carousel support
    const images: string[] = [];
    const videoMatches: string[] = [];
    
    // image_versions2 candidates
    const imageMatches = html.matchAll(/"image_versions2":\s*\{\s*"candidates":\s*\[\s*\{\s*"url":\s*"([^"]+)"/gi);
    for (const match of imageMatches) {
      const imgUrl = match[1].replace(/\\u0025/g, "%").replace(/\\\//g, "/").replace(/&amp;/g, "&");
      if (!imgUrl.includes("/profiles/") && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // video_versions candidates (for carousels)
    const carouselVideoMatches = html.matchAll(/"video_versions":\s*\[\s*\{\s*"type":\s*\d+,\s*"url":\s*"([^"]+)"/gi);
    for (const match of carouselVideoMatches) {
      const vidUrl = match[1].replace(/\\u0025/g, "%").replace(/\\\//g, "/").replace(/&amp;/g, "&");
      if (!videoMatches.includes(vidUrl)) {
        videoMatches.push(vidUrl);
      }
    }

    // Primary media logic
    const primaryVideo = resolvedUrl || videoMatches[0];
    
    // Heuristic: If we found a video, and it's not clearly a large carousel, 
    // filter out the images to avoid thumbnail-confusion in the bot
    const finalImages = (primaryVideo && images.length <= 2) ? [] : images.slice(0, 10);
    const finalVideo = primaryVideo;

    const thumbnailMatch =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<title>([^<]+)<\/title>/i);

    if (finalVideo || thumbnailMatch || finalImages.length > 0) {
      const thumbUrl = thumbnailMatch
        ? thumbnailMatch[1].replace(/&amp;/g, "&")
        : finalImages[0] || "";
      const rawTitle = titleMatch ? titleMatch[1].trim() : "Threads post";
      const title = decodeHtmlEntities(rawTitle);

      const videoOptions: MediaOption[] = finalVideo
        ? [
            {
              id: "threads-video",
              label: "HD Video",
              ext: "mp4",
              qualityLabel: "HD",
            },
          ]
        : [];

      return {
        title,
        thumbnail: thumbUrl,
        duration: null,
        uploader: "Threads",
        platform: "threads",
        extractorNote: "Scraped via high-quality metadata fallback",
        videoOptions,
        audioOptions: [],
        images: finalImages,
        resolvedUrl: finalVideo,
      };
    }

    throw new Error("Could not find media in Threads page metadata");
  } catch (err) {
    logServer("error", "media.info.scrape.threads.failed", {
      url: urlForLogs(fetchUrl),
      error: String(err),
    });
    throw err;
  }
}

export async function scrapeTikTokCarousel(url: string): Promise<MediaInfo> {
  // Clean TikTok URL to remove tracking parameters and ensure canonical format
  let cleanUrl = url.split("?")[0];
  if (cleanUrl.includes("vt.tiktok.com") || cleanUrl.includes("vm.tiktok.com")) {
     // For short URLs, cleaning ? is enough as they redirect anyway.
  }
  
  logServer("info", "media.info.scrape.tiktok.carousel.started", {
    url: urlForLogs(cleanUrl),
  });

  try {
    const response = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(cleanUrl)}`,
    });

    if (!response.ok) {
      throw new Error(
        `tikwm API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    if (data.code !== 0 || !data.data) {
      throw new Error(
        data.msg || "Could not extract TikTok carousel via tikwm",
      );
    }

    const mediaData = data.data;
    let images: string[] = [];

    if (Array.isArray(mediaData.images) && mediaData.images.length > 0) {
      images = mediaData.images.map((u: any) => (typeof u === "string" && u.startsWith("//") ? `https:${u}` : u));
    } else if (mediaData.image_post_info?.images) {
      images = mediaData.image_post_info.images
        .map((img: any) => img.display_image?.url_list?.[0])
        .filter((u: any): u is string => typeof u === "string")
        .map((u: string) => (u.startsWith("//") ? `https:${u}` : u));
    }

    // If it's a video-only post, images will be empty, which is fine for enrichment fallback

    const audioUrlCandidate = mediaData.music || mediaData.music_info?.play || "";
    let audioUrl = "";
    if (typeof audioUrlCandidate === "string" && audioUrlCandidate.length > 0) {
      audioUrl = audioUrlCandidate.startsWith("//") ? `https:${audioUrlCandidate}` : audioUrlCandidate;
      if (!audioUrl.startsWith("http")) audioUrl = "";
    }

    const musicAuthor = mediaData.music_info?.author || "";
    const musicTitle = mediaData.music_info?.title || "";
    let audioTitle = "TikTok Audio";
    
    if (musicAuthor && musicTitle) {
      audioTitle = `${musicAuthor} - ${musicTitle}`;
    } else if (musicTitle || musicAuthor) {
      audioTitle = musicTitle || musicAuthor;
    }

    const audioOptions: MediaOption[] = audioUrl
      ? [
          {
            id: `tiktok-audio-${mediaData.id || "music"}`,
            label: audioTitle,
            ext: "mp3",
            qualityLabel: "Best",
          },
        ]
      : [];

    // Build video option from tikwm play/hdplay URL
    const rawVideoUrl = mediaData.hdplay || mediaData.play || "";
    let resolvedVideoUrl = "";
    if (typeof rawVideoUrl === "string" && rawVideoUrl.startsWith("http")) {
      // Validation: If it's a slideshow, sometimes 'play' is the music URL.
      // If play matches audioUrl and it's a carousel, it's not a real video.
      if (images.length > 0 && !mediaData.hdplay && rawVideoUrl === audioUrl) {
        resolvedVideoUrl = "";
      } else {
        resolvedVideoUrl = rawVideoUrl;
      }
    }

    const videoOptions: MediaOption[] = resolvedVideoUrl
      ? [
          {
            id: "tiktok-direct-video",
            label: `${mediaData.title || "TikTok Video"} — Direct`,
            ext: "mp4",
            qualityLabel: mediaData.hdplay ? "HD" : "Best",
            height: mediaData.height || undefined,
          },
        ]
      : [];

    const result: MediaInfo = {
      title: mediaData.title || audioTitle || "TikTok Media",
      uploader: mediaData.author?.nickname || mediaData.author?.unique_id,
      duration: mediaData.duration,
      platform: "tiktok",
      thumbnail: mediaData.cover?.startsWith("//") ? `https:${mediaData.cover}` : mediaData.cover,
      images,
      videoOptions,
      audioOptions,
      resolvedUrl: audioUrl || undefined,       // audio direct URL
      resolvedVideoUrl: resolvedVideoUrl || undefined, // video direct URL
    };

    return result;

  } catch (err) {
    logServer("error", "media.info.scrape.tiktok.failed", {
      url: urlForLogs(url),
      error: String(err),
    });
    throw err;
  }
}

async function expandUrl(url: string): Promise<string> {
  const needsExpansion = [
    "vt.tiktok.com",
    "vm.tiktok.com",
    "youtu.be",
    "t.co",
    "facebook.com/share",
    "fb.watch",
  ].some((pattern) => url.includes(pattern));

  if (!needsExpansion) {
    return url;
  }

  try {
    const response = await fetch(url, {
      method: "GET", // Use GET to ensure we follow all levels of redirects
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

async function scrapeFacebookInfo(url: string): Promise<MediaInfo> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
    });

    const html = await response.text();

    const titleMatch = html.match(
      /<meta property="og:title" content="([^"]+)"/i,
    );
    const thumbnailMatch = html.match(
      /<meta property="og:image" content="([^"]+)"/i,
    );
    const descriptionMatch = html.match(
      /<meta property="og:description" content="([^"]+)"/i,
    );

    const title = decodeHtmlEntities(titleMatch ? titleMatch[1] : "");
    const thumbnail = thumbnailMatch
      ? thumbnailMatch[1].replace(/&amp;/g, "&")
      : "";
    const description = decodeHtmlEntities(
      descriptionMatch ? descriptionMatch[1] : "",
    );

    const images: string[] = [];
    if (thumbnail) images.push(thumbnail);

    // Heuristic for finding other images in the post carousel/album
    const imgRegex = /"https:\/\/scontent\.[^"]+\.jpg[^"]*"/g;
    const matches = html.match(imgRegex);
    if (matches) {
      matches.forEach((m) => {
        const u = m
          .replace(/"/g, "")
          .replace(/\\/g, "")
          .replace(/&amp;/g, "&");
        // Filter out common UI icons/tracking pixels by checking for known dimensions or patterns
        if (
          !images.includes(u) &&
          !u.includes("/cp0/") &&
          !u.includes("/p100x100/")
        ) {
          images.push(u);
        }
      });
    }

    return normalizeMediaInfo({
      title: title || description || "Facebook Post",
      thumbnail,
      duration: null,
      uploader: "Facebook",
      platform: "facebook",
      images: images.length > 0 ? [...new Set(images)].slice(0, 15) : undefined,
      videoOptions: [],
      audioOptions: [],
    });
  } catch (err) {
    logServer("error", "media.info.scrape.facebook.failed", {
      url: urlForLogs(url),
      error: String(err),
    });
    throw err;
  }
}

export async function fetchMediaInfo(rawUrl: string): Promise<MediaInfo> {
  const url = await expandUrl(rawUrl);
  const allowPlaylistInfo = isYoutubePlaylistUrl(url);

  const sourceProfile = getSourceProfile(url);
  logServer("info", "media.info.fetch.started", {
    platform: sourceProfile.platform,
    url: urlForLogs(url),
    extractorArgs: sourceProfile.extractorArgs,
  });

  try {
    const result = await runCommand(
      appConfig.ytDlpBin,
      [
        ...getAuthArgs(),
        ...sourceProfile.extractorArgs,
        "--dump-single-json",
        ...(allowPlaylistInfo ? [] : ["--no-playlist"]),
        "--socket-timeout",
        "30",
        "--geo-bypass",
        "--no-check-certificates",
        url,
      ],
      INFO_TIMEOUT_MS,
    );
    logServer("info", "media.info.fetch.middle.result", {
      platform: sourceProfile.platform,
      url: urlForLogs(url),
      extractorArgs: sourceProfile.extractorArgs,
      result
    });

    if (result.exitCode !== 0) {
      if (sourceProfile.platform === "threads") {
        return await scrapeThreadsInfo(url);
      }
      if (sourceProfile.platform === "tiktok") {
        return await scrapeTikTokCarousel(url);
      }
      if (sourceProfile.platform === "facebook") {
        return await scrapeFacebookInfo(url);
      }
      throw new Error(simplifyError(result.stderr));
    }

    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    const playlistEntries = extractPlaylistEntries(parsed, url);

    let images: string[] | undefined;
    if (parsed._type === "playlist" && Array.isArray(parsed.entries) && playlistEntries.length === 0) {
      const extracted = (parsed.entries as Record<string, unknown>[])
        .flatMap((entry) => {
          if (
            entry.url &&
            typeof entry.url === "string" &&
            /\.(jpg|jpeg|png|webp)/i.test(entry.url as string)
          ) {
            return [entry.url as string];
          }
          if (Array.isArray(entry.formats)) {
            const imgFmt = (entry.formats as Record<string, unknown>[]).find(
              (f) =>
                typeof f.url === "string" &&
                /\.(jpg|jpeg|png|webp)/i.test(f.url as string),
            );
            if (imgFmt && typeof imgFmt.url === "string") return [imgFmt.url];
          }
          if (typeof entry.thumbnail === "string")
            return [entry.thumbnail as string];
          return [];
        })
        .filter(Boolean);
      if (extracted.length > 0) images = extracted;
    }

    const videoOptions = pickVideoOptions(parsed);
    const audioOptions = pickAudioOptions(parsed);

    const mediaInfo: MediaInfo = {
      title: decodeHtmlEntities(
        typeof parsed.title === "string" ? parsed.title : "",
      ),
      thumbnail: typeof parsed.thumbnail === "string" ? parsed.thumbnail : "",
      duration: typeof parsed.duration === "number" ? parsed.duration : null,
      uploader: decodeHtmlEntities(
        typeof parsed.uploader === "string" ? parsed.uploader : "",
      ),
      platform: sourceProfile.platform,
      extractorNote: sourceProfile.note,
      width: typeof parsed.width === "number" ? parsed.width : undefined,
      height: typeof parsed.height === "number" ? parsed.height : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
      videoOptions,
      audioOptions,
      images,
      playlist:
        playlistEntries.length > 0
          ? {
              id: typeof parsed.id === "string" ? parsed.id : undefined,
              title: decodeHtmlEntities(
                typeof parsed.title === "string" && parsed.title.trim()
                  ? parsed.title
                  : "Playlist",
              ),
              count:
                typeof parsed.playlist_count === "number"
                  ? parsed.playlist_count
                  : playlistEntries.length,
              entries: playlistEntries,
            }
          : undefined,
    };

    // TikTok Enrichment Fallback: If no audioOptions, try to find the audio via Tikwm
    if (sourceProfile.platform === "tiktok" && mediaInfo.audioOptions.length === 0) {
      try {
        const carouselInfo = await scrapeTikTokCarousel(url);
        if (carouselInfo.audioOptions.length > 0) {
          mediaInfo.audioOptions = carouselInfo.audioOptions;
        }
        if (!mediaInfo.resolvedUrl && carouselInfo.resolvedUrl) {
          mediaInfo.resolvedUrl = carouselInfo.resolvedUrl;
        }
      } catch {
        // Fallback failed, keep original yt-dlp info
      }
    }

    return normalizeMediaInfo(mediaInfo);
  } catch (err) {
    if (url.includes("threads.net") || url.includes("threads.com")) {
      return normalizeMediaInfo(await scrapeThreadsInfo(url));
    }
    if (url.includes("tiktok.com")) {
      return normalizeMediaInfo(await scrapeTikTokCarousel(url));
    }
    throw err;
  }
}

export async function executeDownload(jobId: string) {
  const job = getJobs().get(jobId);

  if (!job) {
    return;
  }

  let jobUrl = job.resolvedUrl || job.url;
  const isDirect = !!job.resolvedUrl;

  const tempDir = getJobTempDir(jobId);
  mkdirSync(tempDir, { recursive: true });
  const sourceProfile = getSourceProfile(jobUrl);

  job.status = "downloading";
  job.queuePosition = 0;
  job.updatedAt = Date.now();
  syncJobState();

  updateJobProgress(job, 5, "Preparing media extraction...");
  logServer("info", "media.download.started", {
    jobId: job.id,
    mode: job.mode,
    targetExt: job.targetExt,
    formatId: job.formatId,
    source: job.source,
    platform: sourceProfile.platform,
    url: urlForLogs(job.url),
    isDirect,
  });

  const controller = new AbortController();
  getActiveControllers().set(jobId, controller);
  const signal = controller.signal;

  try {
    if (isDirect) {
      updateJobProgress(job, 10, "Downloading direct media stream");
      const directExt = job.mode === "audio" ? "mp3" : "mp4";
      const directPath = join(tempDir, `source.${directExt}`);
      await downloadDirectFile(job, jobUrl, directPath, signal);
    } else {
      let sourceArgs: string[] = [];

      if (sourceProfile.platform === "tiktok") {
        sourceArgs = [
          ...getAuthArgs(),
          ...sourceProfile.extractorArgs,
          "--no-playlist",
          "--newline",
          "--progress",
          "--no-part",
          "--ffmpeg-location",
          appConfig.ffmpegBin,
          "-o",
          getTempOutputTemplate(jobId),
        ];
      } else {
        sourceArgs = [
          ...getAuthArgs(),
          ...sourceProfile.extractorArgs,
          "--no-playlist",
          "--newline",
          "--progress",
          "--socket-timeout",
          "30",
          "--retries",
          "10",
          "--no-part",
          "--geo-bypass",
          "--no-check-certificates",
          "--prefer-free-formats",
          "--hls-prefer-native",
          "--ffmpeg-location",
          appConfig.ffmpegBin,
          "-o",
          getTempOutputTemplate(jobId),
        ];
      }

      if (job.mode === "audio") {
        sourceArgs.push("-f", job.formatId || "bestaudio/best");
      } else {
        sourceArgs.push(
          "-f",
          job.formatId
            ? `${job.formatId}+bestaudio/${job.formatId}/bestvideo+bestaudio/best`
            : "bestvideo+bestaudio/best",
          "--format-sort",
          "res:1080,vcodec:h264,vbr",
          "--merge-output-format",
          "mp4",
        );
      }

      sourceArgs.push(jobUrl);

      logServer("info", "media.download.started", {
        jobId,
        platform: sourceProfile.platform,
        url: urlForLogs(job.url),
        command: `yt-dlp ${sourceArgs.map((arg) => (arg.includes("cookie") ? "***" : arg)).join(" ")}`,
      });

      const downloadResult = await runCommand(appConfig.ytDlpBin, sourceArgs, {
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
        idleTimeoutMs: DOWNLOAD_IDLE_TIMEOUT_MS,
        idleTimeoutMessage: `Download stalled for ${Math.round(DOWNLOAD_IDLE_TIMEOUT_MS / 1000)} seconds. Retry this file.`,
        onStdoutLine: (line) => parseProgressLine(job, line),
        onStderrLine: (line) => parseProgressLine(job, line),
        signal,
      });

      if (downloadResult.exitCode !== 0) {
        job.status = "error";
        job.error = simplifyError(downloadResult.stderr);
        job.updatedAt = Date.now();
        logServer("error", "media.download.fetch.failed", {
          jobId: job.id,
          platform: sourceProfile.platform,
          url: urlForLogs(job.url),
          exitCode: downloadResult.exitCode,
          stderr: downloadResult.stderr.slice(-500),
        });
        updateJobProgress(job, 0, "❌ Error while processing");
        return;
      }
    }

    const sourceFile = findPrimaryMediaFile(tempDir);

    if (!sourceFile) {
      job.status = "error";
      job.error = "Download finished without a local source file";
      job.updatedAt = Date.now();
      logServer("error", "media.download.source_file.missing", {
        jobId: job.id,
        platform: sourceProfile.platform,
        tempDir,
      });
      updateJobProgress(job, 0, "❌ Error while processing");
      return;
    }

    const sourceExt = extname(sourceFile).toLowerCase();
    let finalExt = job.targetExt;
    let outputPath = getFinalOutputPath(jobId, finalExt);

    if (isImageExt(sourceExt)) {
      finalExt = sourceExt.replace(".", "");
      outputPath = getFinalOutputPath(jobId, finalExt);
      copyFileSync(sourceFile, outputPath);
      updateJobProgress(job, 100, "Image ready for download");
      logServer("info", "media.download.image_passthrough", {
        jobId: job.id,
        platform: sourceProfile.platform,
        sourceExt,
        finalExt,
      });
    } else if (job.mode === "audio") {
      updateJobProgress(job, 92, `Please wait, encoding ${job.targetExt.toUpperCase()} audio`);
      await convertAudio(job, sourceFile, outputPath, signal);
      updateJobProgress(job, 96, `Wait a little bit, ${job.targetExt.toUpperCase()} audio is ready`);
    } else {
      updateJobProgress(job, 92, `Please wait, finalizing ${job.targetExt.toUpperCase()} video`);
      await convertVideo(job, sourceFile, outputPath, signal);
      updateJobProgress(job, 96, `Wait a little bit, ${job.targetExt.toUpperCase()} video is ready`);
    }

    const safeTitle = sanitizeFilename(job.title) || `pulsorclip-${job.id}`;
    logServer("info", "media.convert.success", { jobId: job.id, outputPath });
    updateJobProgress(job, 100, "Ready for download");
    job.status = "done";
    job.progress = 100;
    job.progressLabel = "Ready for download";
    job.filePath = outputPath;
    job.filename = `${safeTitle}.${finalExt}`;
    job.updatedAt = Date.now();
    syncJobState(job);
    logServer("info", "media.download.done", { jobId: job.id, filename: job.filename });
    trackDownloadCompleted(job.source);
    logServer("info", "media.download.completed", {
      jobId: job.id,
      platform: sourceProfile.platform,
      filename: job.filename,
      finalExt,
      progressLabel: job.progressLabel,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Aborted") {
      job.status = "error";
      job.error = "Cancelled by user during processing.";
      job.progressLabel = "Cancelled";
      logServer("info", "media.download.cancelled", { jobId: job.id });
      updateJobProgress(job, 0, "❌ Cancelled");
    } else {
      job.status = "error";
      job.error = error instanceof Error ? error.message : "Unknown process failure";
      logServer("error", "media.download.failed", {
        jobId: job.id,
        platform: sourceProfile.platform,
        url: urlForLogs(job.url),
        message: job.error,
      });
      updateJobProgress(job, 0, "❌ Error while processing");
    }
    job.updatedAt = Date.now();
    updateJobProgress(job, 0, "❌ Error occurred during processing");
    syncJobState(job);
  } finally {
    getActiveControllers().delete(jobId);
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort
    }
  }
}

async function processQueue() {
  if (getActiveJobId()) {
    return;
  }

  const nextJobId = getQueue().shift();

  if (!nextJobId) {
    updateQueuePositions();
    return;
  }

  setActiveJobId(nextJobId);
  updateQueuePositions();

  try {
    await executeDownload(nextJobId);
  } catch (error) {
    const job = getJobs().get(nextJobId);
    if (job) {
      job.status = "error";
      job.error = error instanceof Error ? error.message : "Fatal download error";
      job.updatedAt = Date.now();
      syncJobState();
    }
    logServer("error", "media.queue.process.fatal", {
      jobId: nextJobId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    setActiveJobId(null);
    updateQueuePositions();

    if (getQueue().length > 0) {
      void processQueue();
    }
  }
}

export function createDownloadJob(input: DownloadRequestPayload) {
  ensureAppDirs();
  const mode = input.mode;
  const defaultExt = mode === "audio" ? "mp3" : "mp4";
  const jobId = randomUUID().replace(/-/g, "").slice(0, 12);

  const job: DownloadJob = {
    id: jobId,
    url: input.url,
    mode,
    formatId: input.formatId || null,
    targetExt: input.targetExt || defaultExt,
    title: input.title || "",
    source: input.source || "web",
    status: "queued",
    progress: 0,
    progressLabel: "Queued",
    queuePosition: getQueue().length + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resolvedUrl: input.resolvedUrl,
    thumbnail: input.thumbnail,
    description: input.description,
    tags: input.tags,
  };

  getJobs().set(jobId, job);
  getQueue().push(jobId);
  trackDownloadCreated(job.source);
  updateQueuePositions();
  logServer("info", "media.download.queued", {
    jobId: job.id,
    mode: job.mode,
    targetExt: job.targetExt,
    formatId: job.formatId,
    source: job.source,
    url: urlForLogs(job.url),
    queuePosition: job.queuePosition,
  });
  syncJobState();
  void processQueue();

  return job;
}

export function getDownloadJob(jobId: string) {
  const storedJob = getStoredJob(jobId);

  if (storedJob) {
    // Sync to memory
    getJobs().set(jobId, storedJob);
    return storedJob;
  }

  return getJobs().get(jobId) || null;
}

export function getQueueSnapshot() {
  const activeJobId = getActiveJobId();
  const activeJob = activeJobId ? getJobs().get(activeJobId) || null : null;

  return {
    queuedJobIds: [...getQueue()],
    queuedCount: getQueue().length,
    activeJobId,
    activeJob,
    totalJobs: getJobs().size,
    errorJobs: [...getJobs().values()].filter((job) => job.status === "error")
      .length,
    completedJobs: [...getJobs().values()].filter((job) => job.status === "done")
      .length,
  };
}

export function listDownloadJobs(source?: "web" | "bot") {
  return [...getJobs().values()]
    .filter((job) => !source || job.source === source)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function cancelDownloadJob(jobId: string) {
  const job = getJobs().get(jobId);

  if (!job) {
    return false;
  }

  if (job.status === "queued") {
    const index = getQueue().indexOf(jobId);
    if (index >= 0) {
      getQueue().splice(index, 1);
    }
    job.status = "error";
    job.error = "Cancelled by user before processing started.";
    job.progress = 0;
    job.progressLabel = "Cancelled";
    job.queuePosition = 0;
    job.updatedAt = Date.now();
    updateQueuePositions();
    syncJobState();
    return true;
  }

  if (job.status === "downloading") {
    const controller = getActiveControllers().get(jobId);
    if (controller) {
      controller.abort();
      return true;
    }
  }

  return false;
}

export function getQueuePosition(jobId: string) {
  const job = getJobs().get(jobId);

  if (!job || job.status !== "queued") {
    return 0;
  }

  return job.queuePosition || 0;
}

export function requireCompletedJob(jobId: string) {
  const job = getJobs().get(jobId);

  if (!job || job.status !== "done" || !job.filePath || !job.filename) {
    return null;
  }

  return {
    ...job,
    filePath: job.filePath,
    filename: job.filename,
    size: statSync(job.filePath).size,
  };
}

export async function waitForJob(jobId: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = getDownloadJob(jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === "done" || job.status === "error") {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error("Timed out waiting for job");
}
