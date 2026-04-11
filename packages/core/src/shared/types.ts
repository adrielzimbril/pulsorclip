export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEMES)[number];

export type DownloadMode = "video" | "audio";
export type VideoContainer = "mp4" | "webm" | "mkv";
export type AudioContainer = "mp3" | "m4a";
export type JobSource = "web" | "bot";

export type MediaOption = {
  id: string;
  label: string;
  ext: string;
  qualityLabel: string;
  height?: number;
  abr?: number;
  fps?: number;
};

export type MediaInfo = {
  title: string;
  thumbnail: string;
  duration: number | null;
  uploader: string;
  platform?: string;
  extractorNote?: string;
  width?: number;
  height?: number;
  videoOptions: MediaOption[];
  audioOptions: MediaOption[];
  /** Present when the URL resolves to a photo gallery (carousel). */
  images?: string[];
  /** A direct media URL found during scraping/analysis, bypassing platform-specific extractors if needed. */
  resolvedUrl?: string | null;
  postId?: string;
};

export type JobStatus = "queued" | "downloading" | "done" | "error";

export type DownloadJob = {
  id: string;
  url: string;
  mode: DownloadMode;
  formatId: string | null;
  targetExt: string;
  title: string;
  status: JobStatus;
  progress: number;
  progressLabel?: string;
  error?: string;
  filePath?: string;
  filename?: string;
  queuePosition?: number;
  source: JobSource;
  createdAt: number;
  updatedAt: number;
  /** A direct media URL found during original analysis, used to bypass standard extractors. */
  resolvedUrl?: string | null;
  thumbnail?: string | null;
};

export type DownloadRequestPayload = {
  url: string;
  mode: DownloadMode;
  formatId?: string | null;
  targetExt?: string | null;
  title?: string | null;
  source?: JobSource | null;
  resolvedUrl?: string | null;
  thumbnail?: string | null;
};
