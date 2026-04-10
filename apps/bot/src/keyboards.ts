import { Markup } from "telegraf";
import { appConfig } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale, DownloadMode } from "@pulsorclip/core/shared";
import type { PendingChoice } from "./types";

export function webKeyboard(locale: AppLocale) {
  return Markup.inlineKeyboard([Markup.button.url(t(locale, "botOpenWeb"), appConfig.baseUrl)]);
}

export function modeKeyboard(locale: AppLocale) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(locale, "botVideoLabel"), "mode:video"),
      Markup.button.callback(t(locale, "botAudioLabel"), "mode:audio"),
    ],
    [Markup.button.url(t(locale, "botOpenWeb"), appConfig.baseUrl)],
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

export function qualityKeyboard(choice: PendingChoice, mode: DownloadMode, selectedExt?: string) {
  const locale = choice.locale;
  const options = mode === "video" ? choice.info.videoOptions.slice(0, 6) : choice.info.audioOptions.slice(0, 6);
  const extRow = mode === "video" ? ["mp4", "webm", "mkv"] : ["mp3", "m4a"];
  const activeExt = selectedExt || (mode === "video" ? "mp4" : "mp3");

  return Markup.inlineKeyboard([
    extRow.map((ext) =>
      Markup.button.callback(`${ext === activeExt ? "● " : ""}${ext.toUpperCase()}`, `ext:${choice.id}:${mode}:${ext}`),
    ),
    [Markup.button.callback(`${t(locale, "botBest")} · ${activeExt.toUpperCase()}`, `dl:${choice.id}:${mode}:best:${activeExt}`)],
    ...options.map((option) => [Markup.button.callback(`${option.label} · ${activeExt.toUpperCase()}`, `dl:${choice.id}:${mode}:${option.id}:${activeExt}`)]),
    [Markup.button.callback(t(locale, "botBack"), "back:mode")],
    [Markup.button.url(t(locale, "botOpenWeb"), appConfig.baseUrl)],
  ]);
}
