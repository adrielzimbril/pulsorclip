import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { appConfig } from "./config";
import { runCommand } from "./process";
import type { DownloadJob, DownloadRequestPayload, MediaInfo, MediaOption } from "../shared/types";

declare global {
  var __pulsorclipJobs: Map<string, DownloadJob> | undefined;
}

const jobs = global.__pulsorclipJobs ?? new Map<string, DownloadJob>();
global.__pulsorclipJobs = jobs;

const INFO_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 8 * 60_000;

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
    updateJobProgress(job, Number(percentMatch[1]), normalized.replace(/\[download\]\s*/i, ""));
    return;
  }

  if (normalized.includes("[download] Destination:")) {
    updateJobProgress(job, 4, "Preparing destination");
    return;
  }

  if (normalized.includes("[Merger]")) {
    updateJobProgress(job, 97, "Finalizing merged output");
    return;
  }

  if (normalized.includes("[ExtractAudio]")) {
    updateJobProgress(job, 97, "Extracting audio");
    return;
  }
}

function getOutputTemplate(jobId: string) {
  return join(appConfig.downloadsDir, `${jobId}.%(ext)s`);
}

function getJobFiles(jobId: string) {
  return readdirSync(appConfig.downloadsDir)
    .filter((entry) => entry.startsWith(`${jobId}.`))
    .map((entry) => join(appConfig.downloadsDir, entry));
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
    const ext = typeof current.ext === "string" ? current.ext : "mp4";
    const fps = Number(current.fps || 0) || undefined;
    const tbr = Number(current.tbr || 0);
    const vcodec = current.vcodec;

    if (!id || !height || vcodec === "none") {
      continue;
    }

    const key = `${height}-${ext}`;
    const label = `${height}p${fps ? ` / ${fps}fps` : ""} / ${ext.toUpperCase()}`;
    const existing = entries.get(key);

    if (!existing || tbr > existing.score) {
      entries.set(key, {
        id,
        label,
        ext,
        height,
        fps,
        qualityLabel: `${height}p`,
        score: tbr,
      });
    }
  }

  return [...entries.values()]
    .sort((left, right) => (right.height || 0) - (left.height || 0) || right.score - left.score)
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

    const key = `${abr}-${ext}`;
    const existing = entries.get(key);

    if (!existing || abr > existing.score) {
      entries.set(key, {
        id,
        label: `${abr}kbps / ${ext.toUpperCase()}`,
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
  const result = await runCommand(
    appConfig.ytDlpBin,
    [...getAuthArgs(), "--dump-single-json", "--no-playlist", url],
    INFO_TIMEOUT_MS,
  );

  if (result.exitCode !== 0) {
    throw new Error(simplifyError(result.stderr));
  }

  const parsed = JSON.parse(result.stdout) as Record<string, unknown>;

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    thumbnail: typeof parsed.thumbnail === "string" ? parsed.thumbnail : "",
    duration: typeof parsed.duration === "number" ? parsed.duration : null,
    uploader: typeof parsed.uploader === "string" ? parsed.uploader : "",
    videoOptions: pickVideoOptions(parsed),
    audioOptions: pickAudioOptions(parsed),
  };
}

async function executeDownload(jobId: string) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  job.status = "downloading";
  updateJobProgress(job, 2, "Queued on server");

  const args = [
    ...getAuthArgs(),
    "--no-playlist",
    "--newline",
    "--progress",
    "--ffmpeg-location",
    appConfig.ffmpegBin,
    "-o",
    getOutputTemplate(jobId),
  ];

  if (job.mode === "audio") {
    args.push("-f", job.formatId || "bestaudio/best", "-x", "--audio-format", job.targetExt);
  } else {
    args.push(
      "-f",
      job.formatId ? `${job.formatId}+bestaudio/best` : "bestvideo+bestaudio/best",
      "--merge-output-format",
      job.targetExt,
    );
  }

  args.push(job.url);

  try {
    const result = await runCommand(appConfig.ytDlpBin, args, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      onStdoutLine: (line) => parseProgressLine(job, line),
      onStderrLine: (line) => parseProgressLine(job, line),
    });

    if (result.exitCode !== 0) {
      job.status = "error";
      job.error = simplifyError(result.stderr);
      job.updatedAt = Date.now();
      return;
    }

    const files = getJobFiles(jobId);

    if (!files.length) {
      job.status = "error";
      job.error = "Download finished without a local file";
      job.updatedAt = Date.now();
      return;
    }

    const preferredExtension = `.${job.targetExt}`;
    const primaryFile = files.find((file) => file.endsWith(preferredExtension)) || files[0];

    for (const file of files) {
      if (file === primaryFile) {
        continue;
      }

      try {
        unlinkSync(file);
      } catch {
        // Best-effort cleanup.
      }
    }

    const safeTitle = sanitizeFilename(job.title) || sanitizeFilename(basename(primaryFile, extname(primaryFile)));

    job.status = "done";
    job.progress = 100;
    job.progressLabel = "Ready for download";
    job.filePath = primaryFile;
    job.filename = `${safeTitle || job.id}${extname(primaryFile)}`;
    job.updatedAt = Date.now();
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Unknown process failure";
    job.updatedAt = Date.now();
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
    status: "queued",
    progress: 0,
    progressLabel: "Queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  jobs.set(jobId, job);
  void executeDownload(jobId);

  return job;
}

export function getDownloadJob(jobId: string) {
  return jobs.get(jobId) || null;
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
