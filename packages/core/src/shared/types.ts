export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEMES)[number];

export type DownloadMode = "video" | "audio";
export type VideoContainer = "mp4" | "webm" | "mkv";
export type AudioContainer = "mp3" | "m4a";

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
  videoOptions: MediaOption[];
  audioOptions: MediaOption[];
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
  createdAt: number;
  updatedAt: number;
};

export type DownloadRequestPayload = {
  url: string;
  mode: DownloadMode;
  formatId?: string | null;
  targetExt?: string | null;
  title?: string;
};
