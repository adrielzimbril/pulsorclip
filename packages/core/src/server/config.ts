import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = process.cwd();
const downloadsDir = resolve(
  /* turbopackIgnore: true */ rootDir,
  process.env.PULSORCLIP_DOWNLOAD_DIR || join(rootDir, "downloads"),
);

mkdirSync(downloadsDir, { recursive: true });

export const appConfig = {
  appName: "PulsorClip",
  downloadsDir,
  debugLogs: process.env.PULSORCLIP_DEBUG_LOGS === "true",
  logFullUrls: process.env.PULSORCLIP_LOG_FULL_URLS === "true",
  ytDlpBin: process.env.YTDLP_BIN || "yt-dlp",
  ffmpegBin: process.env.FFMPEG_BIN || "ffmpeg",
  ytDlpCookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",
  ytDlpCookiesFile: process.env.YTDLP_COOKIES_FILE || "",
  ytDlpCookiesBase64: process.env.YTDLP_COOKIES_BASE64 || "",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  defaultLocale: (process.env.PULSORCLIP_DEFAULT_LOCALE || "en") as "en" | "fr",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "pulsorclip_bot",
  telegramUploadLimitBytes: Number(process.env.TELEGRAM_UPLOAD_LIMIT_MB || "45") * 1024 * 1024,
  telegramBotEnabled: process.env.TELEGRAM_BOT_ENABLED !== "false",
  telegramAdminIds: (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0),
  telegramMaintenanceMode: process.env.TELEGRAM_MAINTENANCE_MODE === "true",
};
