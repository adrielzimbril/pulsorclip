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

/**
 * Core application configuration derived from environment variables.
 * Used across the bot and web applications to maintain a consistent state.
 */
export const appConfig = {
  /** The human-readable name of the application */
  appName: "PulsorClip",

  /** 
   * Directory where processed files are stored before delivery.
   * Env: PULSORCLIP_DOWNLOAD_DIR (Default: "downloads")
   */
  get downloadsDir() {
    return resolve(
      getWorkspaceRoot(),
      process.env.PULSORCLIP_DOWNLOAD_DIR || "downloads",
    );
  },

  /** 
   * Enables verbose logging for debugging purposes.
   * Env: PULSORCLIP_DEBUG_LOGS (Default: false)
   */
  debugLogs: process.env.PULSORCLIP_DEBUG_LOGS === "true",

  /** 
   * If true, logs full URLs which might contain sensitive tokens.
   * Env: PULSORCLIP_LOG_FULL_URLS (Default: false)
   */
  logFullUrls: process.env.PULSORCLIP_LOG_FULL_URLS === "true",

  /** 
   * Path to the yt-dlp binary.
   * Env: YTDLP_BIN (Default: auto-discovery in /usr/local/bin or /usr/bin)
   */
  ytDlpBin: resolveBinary(process.env.YTDLP_BIN, "yt-dlp", [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ]),

  /** 
   * Path to the ffmpeg binary.
   * Env: FFMPEG_BIN (Default: auto-discovery in /usr/local/bin or /usr/bin)
   */
  ffmpegBin: resolveBinary(process.env.FFMPEG_BIN, "ffmpeg", [
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ]),

  /** 
   * Optional: Browser to extract cookies from for yt-dlp (e.g., "chrome", "firefox").
   * Env: YTDLP_COOKIES_FROM_BROWSER
   */
  ytDlpCookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",

  /** 
   * Optional: Path to a cookies.txt file for yt-dlp.
   * Env: YTDLP_COOKIES_FILE
   */
  ytDlpCookiesFile: process.env.YTDLP_COOKIES_FILE || "",

  /** 
   * Optional: Base64 encoded cookies.txt content.
   * Env: YTDLP_COOKIES_BASE64
   */
  ytDlpCookiesBase64: process.env.YTDLP_COOKIES_BASE64 || "",

  /** 
   * The base URL of the web application. Used for links in Telegram.
   * Env: NEXT_PUBLIC_APP_URL (Default: http://localhost:10000)
   */
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:10000",

  /** 
   * The default language for the bot and reports.
   * Env: PULSORCLIP_DEFAULT_LOCALE (Values: "en", "fr")
   */
  defaultLocale: (process.env.PULSORCLIP_DEFAULT_LOCALE || "en") as "en" | "fr",

  /** 
   * The public @username of the Telegram bot.
   * Env: TELEGRAM_BOT_USERNAME
   */
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "pulsorclip_bot",

  /** 
   * Maximum file size in bytes for Telegram uploads.
   * Env: TELEGRAM_UPLOAD_LIMIT_MB (Default: 45)
   */
  telegramUploadLimitBytes:
    Number(process.env.TELEGRAM_UPLOAD_LIMIT_MB || "45") * 1024 * 1024,

  /** 
   * Global toggle for the Telegram bot interface.
   * Env: TELEGRAM_BOT_ENABLED (Default: true)
   */
  telegramBotEnabled: process.env.TELEGRAM_BOT_ENABLED !== "false",

  /** 
   * If true, only users in an allowlist can use the bot (not fully implemented).
   * Env: TELEGRAM_BOT_ALLOW_USERS (Default: false)
   */
  telegramBotAllowUsers: process.env.TELEGRAM_BOT_ALLOW_USERS === "true",

  /** 
   * Comma-separated list of Telegram User IDs with admin privileges.
   * Env: TELEGRAM_ADMIN_IDS
   */
  telegramAdminIds: (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0),

  /** 
   * If true, the bot will respond with a maintenance message to non-admins.
   * Env: TELEGRAM_MAINTENANCE_MODE (Default: false)
   */
  telegramMaintenanceMode: process.env.TELEGRAM_MAINTENANCE_MODE === "true",

  /** 
   * The UTC hour (0-23) when the daily statistics report is sent to admins.
   * Env: PULSORCLIP_DAILY_REPORT_HOUR (Default: 0)
   */
  dailyReportHour: Number(process.env.PULSORCLIP_DAILY_REPORT_HOUR || "0"),

  /** 
   * Global toggle for the automated daily statistics report.
   * Env: PULSORCLIP_DAILY_REPORT_ENABLED (Default: true)
   */
  dailyReportEnabled: process.env.PULSORCLIP_DAILY_REPORT_ENABLED !== "false",

  /** 
   * Interval in minutes between system health checks.
   * Env: PULSORCLIP_HEALTH_CHECK_CADENCE_MINS (Default: 15)
   */
  healthCheckCadenceMins: Number(
    process.env.PULSORCLIP_HEALTH_CHECK_CADENCE_MINS || "15",
  ),

  /** 
   * Number of threads ffmpeg is allowed to use for processing.
   * Env: FFMPEG_THREADS (Default: 2)
   */
  ffmpegThreads: Number(process.env.FFMPEG_THREADS || "2"),

  /** 
   * The @username (without @) of the support contact.
   * Env: TELEGRAM_ADMIN_HANDLE (Default: "admin")
   */
  telegramAdminHandle: process.env.TELEGRAM_ADMIN_HANDLE || "admin",
};
