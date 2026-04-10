import {
  getStoredUserPreferences,
  setStoredUserLocale,
  setStoredUserMode,
} from "@pulsorclip/core/server";
import type { AppLocale, DownloadMode } from "@pulsorclip/core/shared";

type BotUserPreferences = {
  locale?: AppLocale;
  mode?: DownloadMode;
};

export function getUserPreferences(userId?: number): BotUserPreferences {
  return getStoredUserPreferences(userId);
}

export function setUserLocale(userId: number | undefined, locale: AppLocale) {
  setStoredUserLocale(userId, locale);
}

export function setUserMode(userId: number | undefined, mode: DownloadMode) {
  setStoredUserMode(userId, mode);
}
