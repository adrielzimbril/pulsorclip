import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

export function resolveRealBinaryPath(bin: string): string {
  if (!bin) return "not_configured";

  try {
    // 1. If absolute, check exists and resolve symlinks
    if (resolve(bin) === bin && existsSync(bin)) {
      return realpathSync(bin);
    }

    // 2. Try 'which' (Linux/macOS) or 'where' (Windows)
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${cmd} ${bin}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const firstLine = result.split("\n")[0]?.trim();

    if (firstLine && existsSync(firstLine)) {
      return realpathSync(firstLine);
    }
  } catch {
    // Silently fall back
  }

  return bin; // Fallback to the requested string
}

export function getWorkspaceRoot(): string {
  let current = /*turbopackIgnore: true*/ process.cwd();
  for (let i = 0; i < 5; i++) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "apps")) &&
      existsSync(join(current, "packages"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

export function verifyBinaries() {
  console.log(`[INFO] Verifying binaries configuration...`);

  const bins = [
    { name: "yt-dlp", path: appConfig.ytDlpBin, arg: "--version" },
    { name: "ffmpeg", path: appConfig.ffmpegBin, arg: "-version" },
  ];

  for (const bin of bins) {
    try {
      const output = execSync(`${bin.path} ${bin.arg}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      console.log(`[OK] ${bin.name} located at: ${bin.path}`);
      if (appConfig.debugLogs) {
        console.log(
          `[DEBUG] ${bin.name} version info: ${output.split("\n")[0]}`,
        );
      }
    } catch (err) {
      console.error(
        `[WARNING] Could not verify ${bin.name} at "${bin.path}". Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export function ensureAppDirs() {
  const dir = resolve(
    getWorkspaceRoot(),
    process.env.PULSORCLIP_DOWNLOAD_DIR || "downloads",
  );
  mkdirSync(dir, { recursive: true });
  verifyBinaries();
}

function resolveBinary(
  envValue: string | undefined,
  fallback: string,
  candidates: string[] = [],
) {
  const requested = envValue?.trim();

  if (requested) {
    return requested;
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export const appConfig = {
  appName: "PulsorClip",
  get downloadsDir() {
    return resolve(
      getWorkspaceRoot(),
      process.env.PULSORCLIP_DOWNLOAD_DIR || "downloads",
    );
  },
  debugLogs: process.env.PULSORCLIP_DEBUG_LOGS === "true",
  logFullUrls: process.env.PULSORCLIP_LOG_FULL_URLS === "true",
  ytDlpBin: resolveBinary(process.env.YTDLP_BIN, "yt-dlp", [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ]),
  ffmpegBin: resolveBinary(process.env.FFMPEG_BIN, "ffmpeg", [
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ]),
  ytDlpCookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",
  ytDlpCookiesFile: process.env.YTDLP_COOKIES_FILE || "",
  ytDlpCookiesBase64: process.env.YTDLP_COOKIES_BASE64 || "",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:10000",
  defaultLocale: (process.env.PULSORCLIP_DEFAULT_LOCALE || "en") as "en" | "fr",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "pulsorclip_bot",
  telegramUploadLimitBytes:
    Number(process.env.TELEGRAM_UPLOAD_LIMIT_MB || "45") * 1024 * 1024,
  telegramBotEnabled: process.env.TELEGRAM_BOT_ENABLED !== "false",
  telegramBotAllowUsers: process.env.TELEGRAM_BOT_ALLOW_USERS === "true",
  telegramAdminIds: (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0),
  telegramMaintenanceMode: process.env.TELEGRAM_MAINTENANCE_MODE === "true",
  dailyReportHour: Number(process.env.PULSORCLIP_DAILY_REPORT_HOUR || "0"),
  dailyReportEnabled: process.env.PULSORCLIP_DAILY_REPORT_ENABLED !== "false",
  healthCheckCadenceMins: Number(
    process.env.PULSORCLIP_HEALTH_CHECK_CADENCE_MINS || "15",
  ),
  ffmpegThreads: Number(process.env.FFMPEG_THREADS || "2"),
  telegramAdminHandle: process.env.TELEGRAM_ADMIN_HANDLE || "admin",
};
