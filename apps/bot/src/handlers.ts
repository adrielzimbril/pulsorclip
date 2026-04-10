import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { extname } from "node:path";
import { Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "telegraf/types";
import {
  appConfig,
  createDownloadJob,
  fetchMediaInfo,
  getDownloadJob,
  getDailySummary,
  requireCompletedJob,
  trackBotUser,
} from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { type AppLocale, type DownloadMode } from "@pulsorclip/core/shared";
import { qualityKeyboard, languageKeyboard, modeKeyboard, webKeyboard } from "./keyboards";
import { sendHealthSnapshot, getCurrentDailySummaryText, sendDailySnapshot } from "./monitoring";
import { getUserPreferences, setUserLocale, setUserMode } from "./preferences";
import { modeByChat, pendingByChat } from "./state";
import type { PendingChoice } from "./types";
import { firstHttpUrl, isAdmin, localeForTelegram, shouldGateForMaintenance } from "./utils";

function statusMessage(locale: AppLocale) {
  return appConfig.telegramMaintenanceMode ? t(locale, "botStatusMaintenance") : t(locale, "botStatusReady");
}

function formatDuration(value: number | null) {
  if (!value) {
    return "Live";
  }

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function helpMessage(locale: AppLocale, admin = false) {
  if (locale === "fr") {
    return [
      "PulsorClip Telegram",
      "",
      "Envoie une URL media directe pour lancer le telechargement.",
      "",
      "Raccourcis:",
      "/language",
      "/video <url> --format=mp4",
      "/audio <url> --format=mp3",
      "/mp4",
      "/mp3",
      "/formats",
      admin ? "/status, /health, /report, /daily" : null,
      "",
      "Si tu envoies seulement une URL, le bot te guidera vers le mode puis un seul panneau format + qualite.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "PulsorClip Telegram",
    "",
    "Send one direct media URL to start the download flow.",
    "",
    "Shortcuts:",
    "/language",
    "/video <url> --format=mp4",
    "/audio <url> --format=mp3",
    "/mp4",
    "/mp3",
    "/formats",
    admin ? "/status, /health, /report, /daily" : null,
    "",
    "If you send only a URL, the bot will guide you to mode first, then one shared format + quality panel.",
  ]
    .filter(Boolean)
    .join("\n");
}

function promptForMode(locale: AppLocale, title?: string) {
  const prefix = title ? `${title}\n\n` : "";
  return `${prefix}${t(locale, "botChooseMode")}`;
}

function sendUrlPrompt(locale: AppLocale, mode: DownloadMode) {
  if (locale === "fr") {
    return mode === "video"
      ? "Mode video memorise. Envoie maintenant une URL ou utilise /video <url> --format=mp4."
      : "Mode audio memorise. Envoie maintenant une URL ou utilise /audio <url> --format=mp3.";
  }

  return mode === "video"
    ? "Video mode saved. Send a URL now or use /video <url> --format=mp4."
    : "Audio mode saved. Send a URL now or use /audio <url> --format=mp3.";
}

function parseCommandRequest(text: string, fallbackMode: DownloadMode) {
  const parts = text.trim().split(/\s+/);
  const formatArg = parts.find((part) => part.startsWith("--format="));
  const url = parts.find((part, index) => index > 0 && /^https?:\/\//i.test(part)) || null;
  const format = formatArg?.split("=")[1]?.trim().toLowerCase() || null;

  return {
    mode: fallbackMode,
    url,
    format,
  };
}

function rememberUser(userId?: number) {
  trackBotUser(userId);
}

function trimTitle(value: string) {
  return value.length > 82 ? `${value.slice(0, 79)}...` : value;
}

function buildMediaSummary(choice: PendingChoice) {
  const parts = [choice.info.uploader, formatDuration(choice.info.duration)].filter(Boolean);
  return [trimTitle(choice.info.title || "Media"), parts.join(" • ")].filter(Boolean).join("\n");
}

function buildSelectionMessage(choice: PendingChoice, locale: AppLocale, copy: string) {
  return [buildMediaSummary(choice), "", copy].join("\n");
}

async function sendPresence(ctx: any, action: "typing" | "upload_photo" | "upload_document" | "upload_video" | "upload_voice" = "typing") {
  try {
    await ctx.sendChatAction(action);
  } catch {
    // Ignore presence failures.
  }
}

async function sendDeliveredMedia(bot: Telegraf, chatId: number, locale: AppLocale, jobId: string, title: string) {
  const file = requireCompletedJob(jobId);

  if (!file?.filePath || !file.filename) {
    await bot.telegram.sendMessage(chatId, t(locale, "botDownloadFailed"), webKeyboard(locale));
    return;
  }

  if (statSync(file.filePath).size > appConfig.telegramUploadLimitBytes) {
    await bot.telegram.sendMessage(chatId, t(locale, "botTooLarge"), webKeyboard(locale));
    return;
  }

  const extension = extname(file.filename).toLowerCase();

  if (extension === ".mp3" || extension === ".m4a") {
    await bot.telegram.sendAudio(chatId, { source: file.filePath, filename: file.filename }, { caption: title });
    return;
  }

  try {
    await bot.telegram.sendVideo(
      chatId,
      { source: file.filePath, filename: file.filename },
      { caption: title, supports_streaming: true },
    );
  } catch {
    await bot.telegram.sendDocument(chatId, { source: file.filePath, filename: file.filename }, { caption: title });
  }
}

function inlineResult(locale: AppLocale, query: string) {
  const hasUrl = !!firstHttpUrl(query);
  const text = hasUrl ? `${t(locale, "botInlineTitle")}\n${query}` : t(locale, "botInlineEmpty");

  return {
    type: "article",
    id: randomUUID(),
    title: t(locale, "botInlineTitle"),
    description: hasUrl ? t(locale, "botInlineDescription") : t(locale, "botInlineEmpty"),
    input_message_content: {
      message_text: text,
    },
    reply_markup: {
      inline_keyboard: [[{ text: t(locale, "botOpenWeb"), url: hasUrl ? `${appConfig.baseUrl}?url=${encodeURIComponent(query)}` : appConfig.baseUrl }]],
    },
  };
}

async function safeDeleteMessage(bot: Telegraf, chatId: number, messageId?: number) {
  if (!messageId) {
    return;
  }

  try {
    await bot.telegram.deleteMessage(chatId, messageId);
  } catch {
    // Ignore cleanup failures.
  }
}

async function sendChoiceMessage(ctx: any, choice: PendingChoice, text: string, replyMarkup: InlineKeyboardMarkup) {
  if (choice.info.thumbnail) {
    await sendPresence(ctx, "upload_photo");
    const message = await ctx.replyWithPhoto(choice.info.thumbnail, {
      caption: text,
      reply_markup: replyMarkup,
    });

    choice.messageId = message.message_id;
    choice.messageKind = "photo";
    return;
  }

  await sendPresence(ctx, "typing");
  const message = await ctx.reply(text, { reply_markup: replyMarkup });
  choice.messageId = message.message_id;
  choice.messageKind = "text";
}

async function editChoiceMessage(bot: Telegraf, chatId: number, choice: PendingChoice, text: string, replyMarkup?: InlineKeyboardMarkup) {
  if (!choice.messageId) {
    return;
  }

  try {
    if (choice.messageKind === "photo") {
      await bot.telegram.editMessageCaption(chatId, choice.messageId, undefined, text, {
        reply_markup: replyMarkup,
      });
      return;
    }

    await bot.telegram.editMessageText(chatId, choice.messageId, undefined, text, {
      reply_markup: replyMarkup,
    });
  } catch {
    // Ignore transient edit issues.
  }
}

function progressBar(progress: number) {
  const total = 12;
  const filled = Math.max(0, Math.min(total, Math.round((progress / 100) * total)));
  return `${"█".repeat(filled)}${"░".repeat(total - filled)}`;
}

function renderJobUpdate(locale: AppLocale, jobId: string) {
  const job = getDownloadJob(jobId);

  if (!job) {
    return locale === "fr" ? "Job introuvable." : "Job not found.";
  }

  if (job.status === "queued") {
    return [
      locale === "fr" ? "⏳ Telechargement en attente" : "⏳ Download queued",
      "",
      t(locale, "botQueueLine").replace("{position}", String(job.queuePosition || 1)),
      locale === "fr"
        ? "Le worker attend un slot libre avant de lancer la preparation."
        : "The worker is waiting for a free slot before starting preparation.",
    ].join("\n");
  }

  if (job.status === "downloading") {
    return [
      locale === "fr" ? "⚙️ Preparation du fichier" : "⚙️ Preparing your file",
      `${progressBar(job.progress)} ${job.progress}%`,
      job.progressLabel || (locale === "fr" ? "Le moteur traite encore le fichier." : "The exporter is still processing the file."),
    ].join("\n");
  }

  if (job.status === "done") {
    return locale === "fr" ? "✅ Fichier pret. Envoi en cours." : "✅ File ready. Delivering now.";
  }

  return job.error || t(locale, "botDownloadFailed");
}

async function trackJobInChat(bot: Telegraf, ctx: any, choice: PendingChoice, jobId: string, title: string) {
  let lastText = "";

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const job = getDownloadJob(jobId);

    if (!job) {
      break;
    }

    const nextText = renderJobUpdate(choice.locale, jobId);

    if (nextText !== lastText) {
      await editChoiceMessage(bot, ctx.chat.id, choice, nextText);
      lastText = nextText;
    }

    if (job.status === "done") {
      await sendPresence(ctx, title.toLowerCase().includes("mp3") ? "upload_voice" : "upload_video");
      await sendDeliveredMedia(bot, ctx.chat.id, choice.locale, jobId, title);
      break;
    }

    if (job.status === "error") {
      await sendPresence(ctx, "typing");
      await ctx.reply(job.error || t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
      break;
    }
  }
}

async function loadAndPrompt(bot: Telegraf, ctx: any, url: string, locale: AppLocale, forcedMode?: DownloadMode, forcedExt?: string | null) {
  await sendPresence(ctx, "typing");
  const loadingMessage = await ctx.reply(t(locale, "botInspecting"));
  const info = await fetchMediaInfo(url);
  const choice: PendingChoice = {
    id: randomUUID().slice(0, 8),
    url,
    info,
    locale,
  };

  pendingByChat.set(ctx.chat.id, choice);
  await safeDeleteMessage(bot, ctx.chat.id, loadingMessage.message_id);

  if (forcedMode) {
    await sendChoiceMessage(
      ctx,
      choice,
      buildSelectionMessage(choice, locale, t(locale, "botPreviewReady")),
      qualityKeyboard(choice, forcedMode, forcedExt || undefined).reply_markup,
    );
    return;
  }

  await sendChoiceMessage(ctx, choice, buildSelectionMessage(choice, locale, t(locale, "botChooseMode")), modeKeyboard(locale).reply_markup);
}

async function replyWelcome(ctx: any, locale: AppLocale) {
  const intro = [statusMessage(locale), t(locale, "botWelcome"), "", helpMessage(locale, isAdmin(ctx.from?.id))].join("\n");
  await sendPresence(ctx, "typing");
  await ctx.reply(intro, modeKeyboard(locale));
}

export function registerBotHandlers(bot: Telegraf) {
  bot.start(async (ctx) => {
    rememberUser(ctx.from?.id);
    const savedLocale = getUserPreferences(ctx.from?.id).locale;

    if (!savedLocale) {
      await sendPresence(ctx, "typing");
      await ctx.reply(t("en", "botChooseLanguage"), languageKeyboard());
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    await replyWelcome(ctx, locale);
  });

  bot.help(async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(helpMessage(locale, isAdmin(ctx.from?.id)), modeKeyboard(locale));
  });

  bot.command("language", async (ctx) => {
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(t("en", "botChooseLanguage"), languageKeyboard());
  });

  bot.command("status", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const summary = getDailySummary();
    const text = [
      statusMessage(locale),
      appConfig.baseUrl,
      `Bot users today: ${summary.botUsers}`,
      `Bot jobs completed: ${summary.downloadsCompleted.bot}`,
      `Web jobs completed: ${summary.downloadsCompleted.web}`,
    ].join("\n");
    await sendPresence(ctx, "typing");
    await ctx.reply(text, webKeyboard(locale));
  });

  bot.command("formats", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(t(locale, "botFormats"), webKeyboard(locale));
  });

  bot.command("health", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendHealthSnapshot(bot);
    await ctx.reply(t(locale, "botHealthSent"));
  });

  bot.command("report", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(getCurrentDailySummaryText());
  });

  bot.command("daily", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendDailySnapshot(bot);
    await ctx.reply(t(locale, "botReportSent"));
  });

  bot.command("video", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const request = parseCommandRequest(ctx.message.text, "video");
    modeByChat.set(ctx.chat.id, "video");
    setUserMode(ctx.from?.id, "video");

    if (!request.url) {
      await sendPresence(ctx, "typing");
      await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
      return;
    }

    try {
      await loadAndPrompt(bot, ctx, request.url, locale, "video", request.format);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.command("audio", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const request = parseCommandRequest(ctx.message.text, "audio");
    modeByChat.set(ctx.chat.id, "audio");
    setUserMode(ctx.from?.id, "audio");

    if (!request.url) {
      await sendPresence(ctx, "typing");
      await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
      return;
    }

    try {
      await loadAndPrompt(bot, ctx, request.url, locale, "audio", request.format);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.command("mp4", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    modeByChat.set(ctx.chat.id, "video");
    setUserMode(ctx.from?.id, "video");
    await sendPresence(ctx, "typing");
    await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
  });

  bot.command("mp3", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    modeByChat.set(ctx.chat.id, "audio");
    setUserMode(ctx.from?.id, "audio");
    await sendPresence(ctx, "typing");
    await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
  });

  bot.on("inline_query", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await ctx.answerInlineQuery([inlineResult(locale, ctx.inlineQuery.query) as never], {
      cache_time: 0,
      is_personal: true,
    });
  });

  bot.on("text", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);

    if (shouldGateForMaintenance(ctx.from?.id)) {
      await ctx.reply(t(locale, "botMaintenanceMessage"), webKeyboard(locale));
      return;
    }

    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return;
    }

    const url = firstHttpUrl(text);

    if (!url) {
      await sendPresence(ctx, "typing");
      await ctx.reply(t(locale, "botInvalidUrl"));
      return;
    }

    try {
      const preferredMode = modeByChat.get(ctx.chat.id) || getUserPreferences(ctx.from?.id).mode;
      await loadAndPrompt(bot, ctx, url, locale, preferredMode);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.action(/lang:(en|fr)/, async (ctx) => {
    const locale = ctx.match[1] as AppLocale;
    rememberUser(ctx.from?.id);
    setUserLocale(ctx.from?.id, locale);
    await ctx.answerCbQuery(locale === "fr" ? "Langue enregistree" : "Language saved");
    try {
      await ctx.editMessageText([t(locale, "botLanguageSaved"), "", t(locale, "botWelcome")].join("\n"), modeKeyboard(locale));
    } catch {
      await ctx.reply([t(locale, "botLanguageSaved"), "", t(locale, "botWelcome")].join("\n"), modeKeyboard(locale));
    }
  });

  bot.action("back:mode", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    const chatId = ctx.chat?.id;
    const choice = chatId ? pendingByChat.get(chatId) : null;
    if (!chatId || !choice) {
      await ctx.answerCbQuery();
      return;
    }
    await ctx.answerCbQuery(locale === "fr" ? "Retour au mode" : "Back to mode");
    await editChoiceMessage(bot, chatId, choice, promptForMode(locale, choice.info.title), modeKeyboard(locale).reply_markup);
  });

  bot.action(/mode:(video|audio)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery();
      await ctx.reply(t(locale, "botMaintenanceMessage"), webKeyboard(locale));
      return;
    }

    const chatId = ctx.chat?.id;
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);

    if (!chatId) {
      await ctx.answerCbQuery("Chat unavailable.");
      return;
    }

    const mode = ctx.match[1] as DownloadMode;
    modeByChat.set(chatId, mode);
    setUserMode(ctx.from?.id, mode);

    const choice = pendingByChat.get(chatId);

    if (!choice) {
      await ctx.answerCbQuery(locale === "fr" ? "Mode enregistre" : "Mode saved");
      await ctx.reply(sendUrlPrompt(locale, mode), webKeyboard(locale));
      return;
    }

    await ctx.answerCbQuery(locale === "fr" ? "Choisis format et qualite" : "Choose format and quality");
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, t(choice.locale, "botPreviewReady")), qualityKeyboard(choice, mode).reply_markup);
  });

  bot.action(/ext:([a-z0-9]+):(video|audio):(mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery();
      await ctx.reply(t(locale, "botMaintenanceMessage"), webKeyboard(locale));
      return;
    }

    const chatId = ctx.chat?.id;

    if (!chatId) {
      await ctx.answerCbQuery("Chat unavailable.");
      return;
    }

    const [, pendingId, rawMode, ext] = ctx.match;
    const choice = pendingByChat.get(chatId);

    if (!choice || choice.id !== pendingId) {
      await ctx.answerCbQuery("Expired.");
      return;
    }

    const mode = rawMode as DownloadMode;
    await ctx.answerCbQuery(ext.toUpperCase());
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, t(choice.locale, "botPreviewReady")), qualityKeyboard(choice, mode, ext).reply_markup);
  });

  bot.action(/dl:([a-z0-9]+):(video|audio):(best|[0-9A-Za-z_-]+):(default|mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery();
      await ctx.reply(t(locale, "botMaintenanceMessage"), webKeyboard(locale));
      return;
    }

    const chatId = ctx.chat?.id;

    if (!chatId) {
      await ctx.answerCbQuery("Chat unavailable.");
      return;
    }

    const [, pendingId, rawMode, selectedFormatId, selectedExt] = ctx.match;
    const choice = pendingByChat.get(chatId);

    if (!choice || choice.id !== pendingId) {
      await ctx.answerCbQuery("Expired.");
      return;
    }

    const mode = rawMode as DownloadMode;
    const fallbackExt = mode === "video" ? "mp4" : "mp3";
    const targetExt = selectedExt === "default" ? fallbackExt : selectedExt;

    await ctx.answerCbQuery(choice.locale === "fr" ? "Telechargement ajoute a la file" : "Download queued");

    try {
      const job = createDownloadJob({
        url: choice.url,
        mode,
        formatId: selectedFormatId === "best" ? null : selectedFormatId,
        targetExt,
        title: choice.info.title,
        source: "bot",
      });

      pendingByChat.delete(chatId);
      void trackJobInChat(bot, ctx, choice, job.id, choice.info.title || "PulsorClip export");
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    }
  });
}
