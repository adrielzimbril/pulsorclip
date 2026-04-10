import type { AppLocale, DownloadMode, MediaInfo } from "@pulsorclip/core/shared";

export type PendingChoice = {
  id: string;
  url: string;
  info: MediaInfo;
  locale: AppLocale;
  messageId?: number;
  messageKind?: "text" | "photo";
};

export type ModeMap = Map<number, DownloadMode>;
export type PendingMap = Map<number, PendingChoice>;
