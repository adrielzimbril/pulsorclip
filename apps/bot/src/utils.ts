import { normalizeLocale } from "@pulsorclip/core/i18n";
import { appConfig } from "@pulsorclip/core/server";
import { getUserPreferences } from "./preferences";

export function localeForTelegram(userId?: number, languageCode?: string) {
  const savedLocale = getUserPreferences(userId).locale;
  return normalizeLocale(savedLocale || languageCode || appConfig.defaultLocale, appConfig.defaultLocale);
}

export function firstHttpUrl(text: string) {
  return text.match(/https?:\/\/\S+/i)?.[0] || null;
}

export function isAdmin(userId?: number) {
  return !!userId && appConfig.telegramAdminIds.includes(userId);
}

export function shouldGateForMaintenance(userId?: number) {
  return appConfig.telegramMaintenanceMode && !isAdmin(userId);
}

export function shouldGateForPublicAccess(userId?: number) {
  return !appConfig.telegramBotAllowUsers && !isAdmin(userId);
}

export function escapeHTML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
