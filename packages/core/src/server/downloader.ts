import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { trackDownloadCompleted, trackDownloadCreated } from "./analytics";
import { appConfig } from "./config";
import { logServer, stderrTail, urlForLogs } from "./logger";
import { runCommand } from "./process";
import { getSourceProfile } from "./source-adapters";
import type { DownloadJob, DownloadRequestPayload, MediaInfo, MediaOption } from "../shared/types";

declare global {
  var __pulsorclipJobs: Map<string, DownloadJob> | undefined;
  var __pulsorclipQueue: string[] | undefined;
  var __pulsorclipActiveJobId: string | null | undefined;
}

const jobs = global.__pulsorclipJobs ?? new Map<string, DownloadJob>();
const queue = global.__pulsorclipQueue ?? [];

global.__pulsorclipJobs = jobs;
global.__pulsorclipQueue = queue;
global.__pulsorclipActiveJobId ??= null;

const INFO_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 12 * 60_000;
const TRANSCODE_TIMEOUT_MS = 25 * 60_000;

function sanitizeFilename(input: string) {
  return input.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 96);
}

function simplifyError(raw: string) {
  const error = raw.trim().split(/\r?\n/).filter(Boolean).at(-1) || raw.trim();

  if (!error) {
    return "Unknown download error";
  }

  if (error.includes("Sign in to confirm you're not a bot")) {
    return "YouTube now requires authenticated cookies for this request. Configure YTDLP_COOKIES_FROM_BROWSER, YTDLP_COOKIES_FILE, or YTDLP_COOKIES_BASE64.";
  }

  if (error.includes("Unsupported URL")) {
    return "Unsupported URL";
  }

  if (error.includes("Private")) {
    return "Private or restricted media";
  }

  if (error.includes("Video unavailable")) {
    return "Video unavailable";
  }

  return error;
}

function updateJobProgress(job: DownloadJob, progress: number, progressLabel: string) {
  job.progress = Math.max(0, Math.min(100, Math.round(progress)));
  job.progressLabel = progressLabel;
  job.updatedAt = Date.now();
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
  writeFileSync(cookieFile, Buffer.from(appConfig.ytDlpCookiesBase64, "base64"));

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
  for (const job of jobs.values()) {
    if (job.status === "queued") {
      const index = queue.indexOf(job.id);
      job.queuePosition = index >= 0 ? index + 1 : 1;
    } else {
      job.queuePosition = 0;
    }
  }
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
  return readdirSync(directory)
    .map((entry) => join(directory, entry))
    .filter((filePath) => !filePath.endsWith(".part") && statSync(filePath).isFile())
    .sort((left, right) => statSync(right).size - statSync(left).size)[0] || null;
}

async function convertAudio(job: DownloadJob, sourcePath: string, outputPath: string) {
  updateJobProgress(job, 92, `Encoding ${job.targetExt.toUpperCase()} audio`);

  const codecArgs =
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
    TRANSCODE_TIMEOUT_MS,
  );

  if (result.exitCode !== 0) {
    throw new Error(simplifyError(result.stderr));
  }
}

async function convertVideo(job: DownloadJob, sourcePath: string, outputPath: string) {
  updateJobProgress(job, 92, `Finalizing ${job.targetExt.toUpperCase()} video`);

  const codecArgs =
    job.targetExt === "mp4"
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
      : job.targetExt === "webm"
        ? ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus", "-b:a", "160k"]
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
    TRANSCODE_TIMEOUT_MS,
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
    const ext = typeof current.ext === "string" ? current.ext.toLowerCase() : "";

    if (!id || !height || vcodec === "none" || ext === "gif" || ext === "jpg" || ext === "png") {
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
    .sort((left, right) => (right.height || 0) - (left.height || 0) || (right.fps || 0) - (left.fps || 0) || right.score - left.score)
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

  return [...entries.values()]
    .sort((left, right) => (right.abr || 0) - (left.abr || 0))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      ext: entry.ext,
      abr: entry.abr,
      qualityLabel: entry.qualityLabel,
    }));
}

export async function fetchMediaInfo(url: string): Promise<MediaInfo> {
  const sourceProfile = getSourceProfile(url);
  logServer("info", "media.info.fetch.started", {
    platform: sourceProfile.platform,
    url: urlForLogs(url),
    extractorArgs: sourceProfile.extractorArgs,
  });
  const result = await runCommand(
    appConfig.ytDlpBin,
    [...getAuthArgs(), ...sourceProfile.extractorArgs, "--dump-single-json", "--no-playlist", url],
    INFO_TIMEOUT_MS,
  );

  if (result.exitCode !== 0) {
    logServer("error", "media.info.fetch.failed", {
      platform: sourceProfile.platform,
      url: urlForLogs(url),
      exitCode: result.exitCode,
      stderrTail: stderrTail(result.stderr),
    });
    throw new Error(simplifyError(result.stderr));
  }

  const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
  const videoOptions = pickVideoOptions(parsed);
  const audioOptions = pickAudioOptions(parsed);

  logServer("info", "media.info.fetch.completed", {
    platform: sourceProfile.platform,
    url: urlForLogs(url),
    title: typeof parsed.title === "string" ? parsed.title : "",
    hasThumbnail: typeof parsed.thumbnail === "string" && Boolean(parsed.thumbnail),
    videoOptions: videoOptions.length,
    audioOptions: audioOptions.length,
  });

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    thumbnail: typeof parsed.thumbnail === "string" ? parsed.thumbnail : "",
    duration: typeof parsed.duration === "number" ? parsed.duration : null,
    uploader: typeof parsed.uploader === "string" ? parsed.uploader : "",
    platform: sourceProfile.platform,
    extractorNote: sourceProfile.note,
    width: typeof parsed.width === "number" ? parsed.width : undefined,
    height: typeof parsed.height === "number" ? parsed.height : undefined,
    videoOptions,
    audioOptions,
  };
}

async function executeDownload(jobId: string) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  const tempDir = getJobTempDir(jobId);
  mkdirSync(tempDir, { recursive: true });
  const sourceProfile = getSourceProfile(job.url);

  job.status = "downloading";
  job.queuePosition = 0;
  updateJobProgress(job, 2, "Connecting to source");
  logServer("info", "media.download.started", {
    jobId: job.id,
    mode: job.mode,
    targetExt: job.targetExt,
    formatId: job.formatId,
    source: job.source,
    platform: sourceProfile.platform,
    url: urlForLogs(job.url),
  });

  const sourceArgs = [
    ...getAuthArgs(),
    ...sourceProfile.extractorArgs,
    "--no-playlist",
    "--newline",
    "--progress",
    "--ffmpeg-location",
    appConfig.ffmpegBin,
    "-o",
    getTempOutputTemplate(jobId),
  ];

  if (job.mode === "audio") {
    sourceArgs.push("-f", job.formatId || "bestaudio/best");
  } else {
    sourceArgs.push(
      "-f",
      job.formatId ? `${job.formatId}+bestaudio/${job.formatId}/bestvideo+bestaudio/best` : "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mkv",
    );
  }

  sourceArgs.push(job.url);

  try {
    const downloadResult = await runCommand(appConfig.ytDlpBin, sourceArgs, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      onStdoutLine: (line) => parseProgressLine(job, line),
      onStderrLine: (line) => parseProgressLine(job, line),
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
        stderrTail: stderrTail(downloadResult.stderr),
      });
      return;
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
      await convertAudio(job, sourceFile, outputPath);
    } else {
      await convertVideo(job, sourceFile, outputPath);
    }

    const safeTitle = sanitizeFilename(job.title) || `pulsorclip-${job.id}`;

    job.status = "done";
    job.progress = 100;
    job.progressLabel = "Ready for download";
    job.filePath = outputPath;
    job.filename = `${safeTitle}.${finalExt}`;
    job.updatedAt = Date.now();
    trackDownloadCompleted(job.source);
    logServer("info", "media.download.completed", {
      jobId: job.id,
      platform: sourceProfile.platform,
      filename: job.filename,
      finalExt,
      progressLabel: job.progressLabel,
    });
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Unknown process failure";
    job.updatedAt = Date.now();
    logServer("error", "media.download.failed", {
      jobId: job.id,
      platform: sourceProfile.platform,
      url: urlForLogs(job.url),
      message: job.error,
    });
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
}

async function processQueue() {
  if (global.__pulsorclipActiveJobId) {
    return;
  }

  const nextJobId = queue.shift();

  if (!nextJobId) {
    updateQueuePositions();
    return;
  }

  global.__pulsorclipActiveJobId = nextJobId;
  updateQueuePositions();

  try {
    await executeDownload(nextJobId);
  } finally {
    global.__pulsorclipActiveJobId = null;
    updateQueuePositions();

    if (queue.length > 0) {
      void processQueue();
    }
  }
}

export function createDownloadJob(input: DownloadRequestPayload) {
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
    queuePosition: queue.length + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  jobs.set(jobId, job);
  queue.push(jobId);
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
  void processQueue();

  return job;
}

export function getDownloadJob(jobId: string) {
  return jobs.get(jobId) || null;
}

export function getQueueSnapshot() {
  const activeJobId = global.__pulsorclipActiveJobId || null;
  const activeJob = activeJobId ? jobs.get(activeJobId) || null : null;

  return {
    queuedJobIds: [...queue],
    queuedCount: queue.length,
    activeJobId,
    activeJob,
    totalJobs: jobs.size,
    errorJobs: [...jobs.values()].filter((job) => job.status === "error").length,
    completedJobs: [...jobs.values()].filter((job) => job.status === "done").length,
  };
}

export function getQueuePosition(jobId: string) {
  const job = jobs.get(jobId);

  if (!job || job.status !== "queued") {
    return 0;
  }

  return job.queuePosition || 0;
}

export function requireCompletedJob(jobId: string) {
  const job = jobs.get(jobId);

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



