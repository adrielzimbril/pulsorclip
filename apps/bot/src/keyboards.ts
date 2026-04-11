import { Markup } from "telegraf";
import { appConfig } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale, DownloadMode } from "@pulsorclip/core/shared";
import type { PendingChoice } from "./types";

export function webKeyboard(locale: AppLocale) {
  return Markup.inlineKeyboard([Markup.button.url(t(locale, "openInWeb"), appConfig.baseUrl)]);
}

export function trackKeyboard(locale: AppLocale, jobId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url(t(locale, "botOpenWeb"), `${appConfig.baseUrl}/track/${jobId}`)],
  ]);
}

export function modeKeyboard(locale: AppLocale) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(locale, "botVideoLabel"), "mode:video"),
      Markup.button.callback(`🎧 ${t(locale, "botAudioLabel")}`, "mode:audio"),
    ],
    [Markup.button.url(t(locale, "openInWeb"), appConfig.baseUrl)],
  ]);
}

export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🇬🇧 English", "lang:en"),
      Markup.button.callback("🇫🇷 Français", "lang:fr"),
    ],
  ]);
}

export function extensionKeyboard(choice: PendingChoice, mode: DownloadMode) {
  const locale = choice.locale;
  const exts = mode === "video" ? ["mp4", "webm", "mkv"] : ["mp3", "m4a"];
  
  return Markup.inlineKeyboard([
    exts.map(ext => Markup.button.callback(ext.toUpperCase(), `ext:${choice.id}:${mode}:${ext}`)),
    [Markup.button.callback(t(locale, "botBack"), "back:mode")],
    [Markup.button.url(t(locale, "openInWeb"), appConfig.baseUrl)],
  ]);
}

export function qualityKeyboard(choice: PendingChoice, mode: DownloadMode, activeExt: string) {
  const locale = choice.locale;
  const options = mode === "video" ? choice.info.videoOptions.slice(0, 8) : choice.info.audioOptions.slice(0, 8);

  return Markup.inlineKeyboard([
    [Markup.button.callback(`🔥 ${t(locale, "botBest")} (${activeExt.toUpperCase()})`, `dl:${choice.id}:${mode}:best:${activeExt}`)],
    ...options.map((option) => [
      Markup.button.callback(`${option.label} (${activeExt.toUpperCase()})`, `dl:${choice.id}:${mode}:${option.id}:${activeExt}`)
    ]),
    [Markup.button.callback(t(locale, "botBack"), `back:ext:${choice.id}:${mode}`)],
    [Markup.button.url(t(locale, "openInWeb"), appConfig.baseUrl)],
  ]);
}

