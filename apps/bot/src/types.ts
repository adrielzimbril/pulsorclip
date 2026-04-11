import type { AppLocale, DownloadMode, MediaInfo } from "@pulsorclip/core/shared";

export type PendingChoice = {
  id: string;
  url: string;
  info: MediaInfo;
  locale: AppLocale;
  requestId: number;
  messageId?: number;
  messageKind?: "text" | "photo";
};

export type QueuedRequest = {
  url: string;
  mode: DownloadMode;
  requestId: number;
};

export type ModeMap = Map<number, DownloadMode>;
export type PendingMap = Map<number, PendingChoice>;
