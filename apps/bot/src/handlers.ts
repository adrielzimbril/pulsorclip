import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { Telegraf } from "telegraf";
import { appConfig, createDownloadJob, fetchMediaInfo, requireCompletedJob, waitForJob } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { type AppLocale, type DownloadMode } from "@pulsorclip/core/shared";
import { modeKeyboard, qualityKeyboard, webKeyboard } from "./keyboards";
import { modeByChat, pendingByChat } from "./state";
import type { PendingChoice } from "./types";
import { firstHttpUrl, localeForTelegram, shouldGateForMaintenance } from "./utils";

function statusMessage(locale: AppLocale) {
  return appConfig.telegramMaintenanceMode ? t(locale, "botStatusMaintenance") : t(locale, "botStatusReady");
}

function helpMessage(locale: AppLocale) {
  if (locale === "fr") {
    return [
      "PulsorClip Telegram",
      "",
      "Envoie une URL media directe pour lancer l inspection.",
      "",
      "Commandes utiles:",
      "/video <url> --format=mp4",
      "/audio <url> --format=mp3",
      "/status",
      "/formats",
      "",
      "Si tu envoies seulement une URL, le bot te demandera si tu veux un export video ou audio.",
    ].join("\n");
  }

  return [
    "PulsorClip Telegram",
    "",
    "Send one direct media URL to start inspection.",
    "",
    "Useful commands:",
    "/video <url> --format=mp4",
    "/audio <url> --format=mp3",
    "/status",
    "/formats",
    "",
    "If you send only a URL, the bot will ask whether you want a video or audio export.",
  ].join("\n");
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

  if (file.filename.endsWith(".mp3") || file.filename.endsWith(".m4a")) {
    await bot.telegram.sendAudio(chatId, { source: file.filePath, filename: file.filename }, { caption: title });
    return;
  }

  await bot.telegram.sendDocument(chatId, { source: file.filePath, filename: file.filename }, { caption: title });
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

async function inspectAndPrompt(bot: Telegraf, ctx: Parameters<Telegraf["on"]>[1] extends never ? never : any, url: string, locale: AppLocale, forcedMode?: DownloadMode, forcedExt?: string | null) {
  await ctx.reply(t(locale, "botInspecting"));
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
    const summary = `${info.title || "Media"}\n${statusMessage(locale)}\n${t(locale, "botChooseQuality")}`;
    await ctx.reply(summary, qualityKeyboard(choice, forcedMode, forcedExt || undefined));
    return;
  }

  const summary = `${info.title || "Media"}\n${statusMessage(locale)}\n${t(locale, "botChooseMode")}`;
  await ctx.reply(summary, modeKeyboard(locale));
}

export function registerBotHandlers(bot: Telegraf) {
  bot.start(async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    const intro = [statusMessage(locale), helpMessage(locale)].join("\n\n");
    await ctx.reply(intro, modeKeyboard(locale));
  });

  bot.help(async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    await ctx.reply(helpMessage(locale), modeKeyboard(locale));
  });

  bot.command("status", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    await ctx.reply(`${statusMessage(locale)}\n${appConfig.baseUrl}`, webKeyboard(locale));
  });

  bot.command("formats", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    await ctx.reply(t(locale, "botFormats"), webKeyboard(locale));
  });

  bot.command("video", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    const request = parseCommandRequest(ctx.message.text, "video");
    modeByChat.set(ctx.chat.id, "video");

    if (!request.url) {
      await ctx.reply(`?? ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
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
    const request = parseCommandRequest(ctx.message.text, "audio");
    modeByChat.set(ctx.chat.id, "audio");

    if (!request.url) {
      await ctx.reply(`?? ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
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
    modeByChat.set(ctx.chat.id, "video");
    await ctx.reply(`?? ${sendUrlPrompt(locale, "video")}`, webKeyboard(locale));
  });

  bot.command("mp3", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    modeByChat.set(ctx.chat.id, "audio");
    await ctx.reply(`?? ${sendUrlPrompt(locale, "audio")}`, webKeyboard(locale));
  });

  bot.on("inline_query", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);
    await ctx.answerInlineQuery([inlineResult(locale, ctx.inlineQuery.query) as never], {
      cache_time: 0,
      is_personal: true,
    });
  });

  bot.on("text", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.language_code);

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
    await ctx.editMessageText(`${choice.info.title || "Media"}\n${t(choice.locale, "botChooseQuality")}`, qualityKeyboard(choice, mode));
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
    await ctx.editMessageText(`${choice.info.title || "Media"}\n${t(choice.locale, "botChooseQuality")}`, qualityKeyboard(choice, mode, ext));
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
    await ctx.reply(`? ${t(choice.locale, "botQueued")}`);

    try {
      const job = createDownloadJob({
        url: choice.url,
        mode,
        formatId: selectedFormatId === "best" ? null : selectedFormatId,
        targetExt,
        title: choice.info.title,
      });

      const finished = await waitForJob(job.id, 8 * 60_000);

      if (finished.status !== "done") {
        await ctx.reply(finished.error || t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
        return;
      }

      await sendDeliveredMedia(bot, chatId, choice.locale, job.id, choice.info.title || "PulsorClip export");
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    }
  });
}
