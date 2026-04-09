import { normalizeLocale } from "@pulsorclip/core/i18n";
import { appConfig } from "@pulsorclip/core/server";

export function localeForTelegram(languageCode?: string) {
  return normalizeLocale(languageCode || appConfig.defaultLocale, appConfig.defaultLocale);
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
