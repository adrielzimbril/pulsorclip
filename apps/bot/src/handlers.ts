import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { extname } from "node:path";
import { Telegraf } from "telegraf";
import { appConfig, createDownloadJob, fetchMediaInfo, getDownloadJob, getDailySummary, requireCompletedJob, trackBotUser } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { type AppLocale, type DownloadMode } from "@pulsorclip/core/shared";
import { getCurrentDailySummaryText, sendDailySnapshot, sendHealthSnapshot } from "./monitoring";
import { modeKeyboard, qualityKeyboard, webKeyboard } from "./keyboards";
import { isAdmin, firstHttpUrl, localeForTelegram, shouldGateForMaintenance } from "./utils";
import { modeByChat, pendingByChat } from "./state";
import type { PendingChoice } from "./types";

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

function helpMessage(locale: AppLocale, includeAdminCommands = false) {
  if (locale === "fr") {
    const lines = [
      "PulsorClip Telegram",
      "",
      "Envoie une URL media directe pour lancer l inspection.",
      "",
      "Raccourcis:",
      "/video <url> --format=mp4",
      "/audio <url> --format=mp3",
      "/mp4",
      "/mp3",
      "/formats",
      "",
      "Si tu envoies seulement une URL, le bot te demandera d abord si tu veux une sortie video ou audio, puis le conteneur et la qualite.",
    ];

    if (includeAdminCommands) {
      lines.push("", "Commandes admin:", "/status", "/health", "/report", "/daily");
    }

    return lines.join("\n");
  }

  const lines = [
    "PulsorClip Telegram",
    "",
    "Send one direct media URL to start inspection.",
    "",
    "Shortcuts:",
    "/video <url> --format=mp4",
    "/audio <url> --format=mp3",
    "/mp4",
    "/mp3",
    "/formats",
    "",
    "If you send only a URL, the bot will ask for mode first, then container and quality.",
  ];

  if (includeAdminCommands) {
    lines.push("", "Admin commands:", "/status", "/health", "/report", "/daily");
  }

  return lines.join("\n");
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
  const text = hasUrl
    ? `${t(locale, "botInlineTitle")}\n${query}`
    : t(locale, "botInlineEmpty");

  return {
    type: "article",
    id: randomUUID(),
    title: t(locale, "botInlineTitle"),
    description: hasUrl ? t(locale, "botInlineDescription") : t(locale, "botInlineEmpty"),
    input_message_content: {
      message_text: text,
    },
    reply_markup: {
      inline_keyboard: [
        [{ text: t(locale, "botOpenWeb"), url: hasUrl ? `${appConfig.baseUrl}?url=${encodeURIComponent(query)}` : appConfig.baseUrl }],
      ],
    },
  };
}

function buildPreviewCaption(choice: PendingChoice) {
  return [choice.info.title || "Media", `${choice.info.uploader || "Unknown source"} • ${formatDuration(choice.info.duration)}`].join("\n");
}

async function sendPreview(ctx: any, choice: PendingChoice) {
  if (!choice.info.thumbnail) {
    return;
  }

  try {
    await ctx.replyWithPhoto(choice.info.thumbnail);
  } catch {
    // Ignore thumbnail failures and continue with text flow.
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
    const queueLead = locale === "fr"
      ? job.queuePosition === 1
        ? "Prochain job a demarrer"
        : `Position dans la file: #${job.queuePosition || 1}`
      : job.queuePosition === 1
        ? "Next job to start"
        : `Queue position: #${job.queuePosition || 1}`;

    return [
      locale === "fr" ? "File d attente active" : "Queue active",
      queueLead,
      job.progressLabel || (locale === "fr" ? "Le worker termine encore un autre export." : "The worker is finishing another export."),
    ].join("\n");
  }

  if (job.status === "downloading") {
    const phase =
      job.progress < 10
        ? locale === "fr"
          ? "Preparation du worker et des fichiers temporaires"
          : "Allocating the worker and temporary files"
        : job.progress < 45
          ? locale === "fr"
            ? "Recuperation des flux source"
            : "Fetching source streams"
          : job.progress < 80
            ? locale === "fr"
              ? "Telechargement du media source"
              : "Downloading source media"
            : job.progress < 96
              ? locale === "fr"
                ? `Construction du conteneur final ${job.targetExt.toUpperCase()}`
                : `Building the final ${job.targetExt.toUpperCase()} container`
              : locale === "fr"
                ? "Ecriture du fichier final et des metadonnees"
                : "Writing the final file and metadata";

    return [
      locale === "fr" ? "Export en cours" : "Export in progress",
      `${progressBar(job.progress)} ${job.progress}%`,
      phase,
      job.progressLabel || (locale === "fr" ? "Le moteur tourne" : "The worker is running"),
    ].join("\n");
  }

  if (job.status === "done") {
    return locale === "fr" ? "Fichier pret. Envoi en cours..." : "File ready. Sending now...";
  }

  return job.error || t(locale, "botDownloadFailed");
}

async function updateJobMessage(bot: Telegraf, chatId: number, messageId: number, text: string) {
  try {
    await bot.telegram.editMessageText(chatId, messageId, undefined, text);
  } catch {
    // Ignore "message is not modified" or transient edit issues.
  }
}

async function trackJobInChat(bot: Telegraf, ctx: any, locale: AppLocale, jobId: string, title: string) {
  const firstText = renderJobUpdate(locale, jobId);
  const initial = await ctx.reply(firstText);
  let lastText = firstText;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const job = getDownloadJob(jobId);

    if (!job) {
      break;
    }

    const nextText = renderJobUpdate(locale, jobId);

    if (nextText !== lastText) {
      await updateJobMessage(bot, ctx.chat.id, initial.message_id, nextText);
      lastText = nextText;
    }

    if (job.status === "done") {
      await sendDeliveredMedia(bot, ctx.chat.id, locale, jobId, title);
      break;
    }

    if (job.status === "error") {
      await ctx.reply(job.error || t(locale, "botDownloadFailed"), webKeyboard(locale));
      break;
    }
  }
}

async function inspectAndPrompt(bot: Telegraf, ctx: any, url: string, locale: AppLocale, forcedMode?: DownloadMode, forcedExt?: string | null) {
  const inspectionMessage = await ctx.reply(t(locale, "botInspecting"));
  const info = await fetchMediaInfo(url);
  const choice: PendingChoice = {
    id: randomUUID().slice(0, 8),
    url,
    info,
    locale,
  };

  pendingByChat.set(ctx.chat.id, choice);

  if (forcedMode) {
    modeByChat.set(ctx.chat.id, forcedMode);
    const summary = `${buildPreviewCaption(choice)}\n\n${statusMessage(locale)}\n${t(locale, "botChooseQuality")}`;
    await bot.telegram.editMessageText(ctx.chat.id, inspectionMessage.message_id, undefined, summary, qualityKeyboard(choice, forcedMode, forcedExt || undefined));
    await sendPreview(ctx, choice);
    return;
  }

  const summary = `${buildPreviewCaption(choice)}\n\n${statusMessage(locale)}\n${t(locale, "botChooseMode")}`;
  await bot.telegram.editMessageText(ctx.chat.id, inspectionMessage.message_id, undefined, summary, modeKeyboard(locale));
  await sendPreview(ctx, choice);
}

export function registerBotHandlers(bot: Telegraf) {
  bot.start(async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const intro = [statusMessage(locale), helpMessage(locale, isAdmin(ctx.from?.id))].join("\n\n");
    await ctx.reply(intro, modeKeyboard(locale));
  });

  bot.help(async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await ctx.reply(helpMessage(locale, isAdmin(ctx.from?.id)), modeKeyboard(locale));
  });

  bot.command("status", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const summary = getDailySummary();
    const text = [
      statusMessage(locale),
      appConfig.baseUrl,
      `Bot users today: ${summary.botUsers}`,
      `Bot jobs completed: ${summary.downloadsCompleted.bot}`,
      `Web jobs completed: ${summary.downloadsCompleted.web}`,
    ].join("\n");
    await ctx.reply(text, webKeyboard(locale));
  });

  bot.command("formats", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await ctx.reply(t(locale, "botFormats"), webKeyboard(locale));
  });

  bot.command("health", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    rememberUser(ctx.from?.id);
    await sendHealthSnapshot(bot);
    await ctx.reply("Admin health check sent.");
  });

  bot.command("report", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    rememberUser(ctx.from?.id);
    await ctx.reply(getCurrentDailySummaryText());
  });

  bot.command("daily", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    rememberUser(ctx.from?.id);
    await sendDailySnapshot(bot);
    await ctx.reply("Daily report sent to admins.");
  });

  bot.command("video", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const request = parseCommandRequest(ctx.message.text, "video");
    modeByChat.set(ctx.chat.id, "video");

    if (!request.url) {
      await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
      return;
    }

    try {
      await inspectAndPrompt(bot, ctx, request.url, locale, "video", request.format);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.command("audio", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    const request = parseCommandRequest(ctx.message.text, "audio");
    modeByChat.set(ctx.chat.id, "audio");

    if (!request.url) {
      await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
      return;
    }

    try {
      await inspectAndPrompt(bot, ctx, request.url, locale, "audio", request.format);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.command("mp4", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    modeByChat.set(ctx.chat.id, "video");
    await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
  });

  bot.command("mp3", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    modeByChat.set(ctx.chat.id, "audio");
    await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
  });

  bot.on("inline_query", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await ctx.answerInlineQuery([inlineResult(locale, ctx.inlineQuery.query) as never], {
      cache_time: 0,
      is_personal: true,
    });
  });

  bot.on("text", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
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
      await ctx.reply(t(locale, "botInvalidUrl"));
      return;
    }

    try {
      const preferredMode = modeByChat.get(ctx.chat.id);
      await inspectAndPrompt(bot, ctx, url, locale, preferredMode);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.action("back:mode", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    const chatId = ctx.chat?.id;
    const choice = chatId ? pendingByChat.get(chatId) : null;
    await ctx.editMessageText(promptForMode(locale, choice?.info.title), modeKeyboard(locale));
  });

  bot.action(/mode:(video|audio)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.language_code);
      await ctx.answerCbQuery();
      await ctx.reply(t(locale, "botMaintenanceMessage"), webKeyboard(locale));
      return;
    }

    const chatId = ctx.chat?.id;
    const locale = localeForTelegram(ctx.from?.language_code);

    if (!chatId) {
      await ctx.answerCbQuery("Chat unavailable.");
      return;
    }

    const mode = ctx.match[1] as DownloadMode;
    modeByChat.set(chatId, mode);

    const choice = pendingByChat.get(chatId);

    if (!choice) {
      await ctx.answerCbQuery();
      await ctx.reply(sendUrlPrompt(locale, mode), webKeyboard(locale));
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(`${buildPreviewCaption(choice)}\n\n${t(choice.locale, "botChooseQuality")}`, qualityKeyboard(choice, mode));
  });

  bot.action(/ext:([a-z0-9]+):(video|audio):(mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.language_code);
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
    await ctx.answerCbQuery();
    await ctx.editMessageText(`${buildPreviewCaption(choice)}\n\n${t(choice.locale, "botChooseQuality")}`, qualityKeyboard(choice, mode, ext));
  });

  bot.action(/dl:([a-z0-9]+):(video|audio):(best|[0-9A-Za-z_-]+):(default|mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.language_code);
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

    await ctx.answerCbQuery();

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
      void trackJobInChat(bot, ctx, choice.locale, job.id, choice.info.title || "PulsorClip export");
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    }
  });
}
