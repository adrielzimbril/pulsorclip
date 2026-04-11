import { randomUUID } from "node:crypto";
import { statSync, createReadStream } from "node:fs";
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
  logServer,
} from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { type AppLocale, type DownloadMode } from "@pulsorclip/core/shared";
import { qualityKeyboard, languageKeyboard, modeKeyboard, webKeyboard, extensionKeyboard } from "./keyboards";
import { getCurrentDailySummaryText, getQueueSnapshotText, getServerHealthText, sendDailySnapshot, sendHealthSnapshot } from "./monitoring";
import { getUserPreferences, setUserLocale, setUserMode } from "./preferences";
import { modeByChat, pendingByChat, userQueues, userProcessing, userRequestCounter } from "./state";
import type { PendingChoice, QueuedRequest } from "./types";
import { firstHttpUrl, isAdmin, localeForTelegram, shouldGateForMaintenance, escapeHTML } from "./utils";

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
  const shortcuts = [
    "/language",
    "/video <url> --format=mp4",
    "/audio <url> --format=mp3",
    "/mp4",
    "/mp3",
    "/formats",
    admin ? "/status, /server, /queue, /health, /report, /daily" : null,
  ].filter(Boolean);

  return [
    t(locale, "botHelpIntro"),
    "",
    t(locale, "botWelcome").split("\n")[0],
    "",
    t(locale, "botHelpShortcutsLine"),
    ...shortcuts,
    "",
    t(locale, "botHelpGuidance"),
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
      ? "Mode video enregistre.\n\nEtape suivante:\n1. envoie un lien media\n2. choisis le format et la qualite\n3. recois le fichier ici quand il est pret\n\nRaccourci possible: /video <url> --format=mp4"
      : "Mode audio enregistre.\n\nEtape suivante:\n1. envoie un lien media\n2. choisis le format et la qualite\n3. recois le fichier ici quand il est pret\n\nRaccourci possible: /audio <url> --format=mp3";
  }

  return mode === "video"
    ? "Video mode saved.\n\nNext step:\n1. send one media link\n2. choose format and quality\n3. receive the file here when it is ready\n\nShortcut: /video <url> --format=mp4"
    : "Audio mode saved.\n\nNext step:\n1. send one media link\n2. choose format and quality\n3. receive the file here when it is ready\n\nShortcut: /audio <url> --format=mp3";
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
  const parts = [choice.info.platform?.toUpperCase(), choice.info.uploader, formatDuration(choice.info.duration)].filter(Boolean);
  const titleLine = `<b>Request #${choice.requestId}</b>\n${escapeHTML(trimTitle(choice.info.title || "Media"))}`;
  return [titleLine, parts.join(" • ")].filter(Boolean).join("\n");
}

function buildSelectionMessage(choice: PendingChoice, locale: AppLocale, statusText: string) {
  const meta = choice.info;
  const webUrl = `${appConfig.baseUrl}?url=${encodeURIComponent(choice.url)}`;
  const sourceLink = `<a href="${choice.url}">Source</a>`;
  const trackLink = `<a href="${webUrl}">Track</a>`;

  return [
    `<b>Request #${choice.requestId}</b>`,
    statusText,
    escapeHTML(trimTitle(meta.title || "")),
    `🔗 ${sourceLink} | 📊 ${trackLink}`,
  ].join("\n");
}

async function sendPresence(ctx: any, action: "typing" | "upload_photo" | "upload_document" | "upload_video" | "upload_voice" = "typing") {
  try {
    await ctx.sendChatAction(action);
  } catch {
    // Ignore presence failures.
  }
}

async function sendDeliveredMedia(bot: Telegraf, chatId: number, locale: AppLocale, jobId: string, title: string) {
  const job = getDownloadJob(jobId);
  const file = requireCompletedJob(jobId);

  if (!job || !file?.filePath || !file.filename) {
    await bot.telegram.sendMessage(chatId, t(locale, "botDownloadFailed"), webKeyboard(locale));
    return;
  }

  if (statSync(file.filePath).size > appConfig.telegramUploadLimitBytes) {
    await bot.telegram.sendMessage(chatId, t(locale, "botTooLarge"), webKeyboard(locale));
    return;
  }

  const extension = extname(file.filename).toLowerCase();
  const finalCaption = `<b>Request #${job.source === "bot" ? (job as any).requestId || "?" : "?"}</b>\n${escapeHTML(title)}\n\n🔗 <a href="${job.url}">Source</a> | 📊 <a href="${appConfig.baseUrl}/track/${jobId}">Track</a>`;
  const options = { caption: finalCaption, parse_mode: "HTML" as const };

  if (extension === ".mp3" || extension === ".m4a") {
    await bot.telegram.sendAudio(chatId, { source: createReadStream(file.filePath), filename: file.filename }, options);
    return;
  }

  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    await bot.telegram.sendPhoto(chatId, { source: createReadStream(file.filePath) }, options);
    return;
  }

  try {
    await bot.telegram.sendVideo(
      chatId,
      { source: createReadStream(file.filePath), filename: file.filename },
      { ...options, supports_streaming: true },
    );
  } catch (err) {
    console.error("Bot video delivery failed, falling back to document:", err);
    await bot.telegram.sendDocument(chatId, { source: createReadStream(file.filePath), filename: file.filename }, options);
  }
}

async function triggerAudioJob(bot: Telegraf, ctx: any, choice: PendingChoice, formatId: string = "best") {
  const targetExt = "mp3";
  const audioOption = choice.info.audioOptions.find((o: any) => o.id === formatId);
  const jobTitle = audioOption ? audioOption.label : choice.info.title;

  try {
    const job = createDownloadJob({
      url: choice.url,
      mode: "audio",
      formatId: formatId === "best" ? null : formatId,
      targetExt,
      title: jobTitle,
      source: "bot",
      resolvedUrl: choice.info.resolvedUrl,
      thumbnail: choice.info.thumbnail,
    });
    
    // Attach requestId to job object (hacky but works since it's in-memory)
    (job as any).requestId = choice.requestId;

    pendingByChat.delete(ctx.chat.id);
    
    // For TikTok auto-triggers, we might not have a choice.messageId we want to reuse if images were just sent
    // So we just reply with a new status if no messageId is present
    if (!choice.messageId) {
       await ctx.reply(`🎧 ${t(choice.locale, "botAudioLabel")}: ${t(choice.locale, "botProcessingShort")}`);
       // Re-fetch to get the new message for tracking
       // But triggerAudioJob is usually followed by trackJobInChat which handles the editing
    }

    void trackJobInChat(bot, ctx, choice, job.id, jobTitle || t(choice.locale, "botExportFallbackTitle"));
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    void processNextInQueue(bot, ctx.from?.id, ctx);
  }
}
async function processNextInQueue(bot: Telegraf, userId: number, ctx: any) {
  const queue = userQueues.get(userId) || [];
  if (queue.length === 0) {
    userProcessing.set(userId, false);
    return;
  }

  userProcessing.set(userId, true);
  const request = queue.shift()!;
  userQueues.set(userId, queue);

  const locale = localeForTelegram(userId, ctx.from?.language_code);
  try {
    await loadAndPrompt(bot, ctx, request.url, locale, request.mode, null, request.requestId);
  } catch (error) {
    await ctx.reply(`❌ Request #${request.requestId}: ${error instanceof Error ? error.message : t(locale, "botDownloadFailed")}`);
    void processNextInQueue(bot, userId, ctx);
  }
}

async function sendImagesGallery(ctx: any, choice: PendingChoice) {
  const images = choice.info.images;
  const locale = choice.locale;

  if (!images || images.length === 0) {
    return;
  }

  try {
    // Internal fix: Ensure URLs are absolute for media group
    const validatedImages = images.map((u: any) => (typeof u === "string" && u.startsWith("//") ? `https:${u}` : u));

    // Send images in groups of 10 (Telegram limit for media groups)
    for (let i = 0; i < validatedImages.length; i += 10) {
      const chunk = validatedImages.slice(i, i + 10);
      const webUrl = `${appConfig.baseUrl}?url=${encodeURIComponent(choice.url)}`;
      await ctx.replyWithMediaGroup(
        chunk.map((url: string, idx: number) => ({
          type: "photo",
          media: url,
          caption: idx === 0 ? `<b>Request #${choice.requestId}</b>\n${escapeHTML(choice.info.title || "")}\n\n🔗 <a href="${choice.url}">Source</a> | 📊 <a href="${webUrl}">Track</a>` : undefined,
          parse_mode: "HTML",
        }))
      );
      // Small delay to avoid flood
      if (i + 10 < validatedImages.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    await ctx.reply(`✅ ${t(locale, "botImagesSent")}`, webKeyboard(locale));
  } catch (error) {
    logServer("error", "bot.images.failed", { error: error instanceof Error ? error.message : "Network error" });
    await ctx.reply("❌ Error sending gallery images. Please use the web app.", webKeyboard(locale));
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
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });

    choice.messageId = message.message_id;
    choice.messageKind = "photo";
    return;
  }

  await sendPresence(ctx, "typing");
  const message = await ctx.reply(text, { reply_markup: replyMarkup, parse_mode: "HTML" });
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
        parse_mode: "HTML",
      });
      return;
    }

    await bot.telegram.editMessageText(chatId, choice.messageId, undefined, text, {
      reply_markup: replyMarkup,
      parse_mode: "HTML",
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

const funnyStages = {
  PREPARING: [
    "🎬 🍕 Ordering pizza for the server's rats...",
    "🎬 🚀 Fueling the rocket...",
    "🎬 ☕ Boiling digital water...",
    "🎬 🍪 Hiding the cookie jar...",
  ],
  DOWNLOADING: [
    "🎬 📦 Packing pixels...",
    "🎬 🇵🇱 Searching for Polish cow...",
    "🎬 🔧 Tightening digital screws...",
    "🎬 🌌 Fetching from the cloud...",
    "🎬 🥨 Twisting the pretzels...",
    "🎬 🎸 Tuning the bass strings...",
  ],
  PROCESSING: [
    "🎬 🧱 Polishing the raw data...",
    "🎬 🧪 Distilling the essence of the video...",
    "🎬 🍳 Cooking the frames to perfection...",
    "🎬 🏎️ Overclocking the hamsters...",
    "🎬 🧙‍♂️ Casting conversion spells...",
  ],
  FINALIZING: [
    "🎬 🧼 Cleaning up the bytes...",
    "🎬 🦆 Feeding the delivery ducks...",
    "🎬 🦉 Consulting the nocturnal owl...",
    "🎬 🍿 Getting the popcorn ready...",
    "🎬 🏁 Sprinkling finishing dust...",
  ],
};

function getFunnyStatus(jobId: string, progress: number, status: string) {
  // 1. Determine Stage
  let stage: keyof typeof funnyStages = "DOWNLOADING";
  
  if (status === "done" || progress >= 100) {
    stage = "FINALIZING";
  } else if (progress >= 90) {
    stage = "PROCESSING";
  } else if (progress < 10) {
    stage = "PREPARING";
  }

  // 2. Stable Selection within stage
  const messages = funnyStages[stage];
  const seed = parseInt(jobId.slice(0, 2), 16) || 0;
  return messages[seed % messages.length];
}

function renderJobUpdate(locale: AppLocale, jobId: string) {
  const job = getDownloadJob(jobId);

  if (!job) {
    return locale === "fr" ? "Job introuvable." : "Job not found.";
  }

  if (job.status === "queued") {
    return [
      locale === "fr" ? "⏳ File d'attente" : "⏳ Queue",
      "",
      t(locale, "botQueueLine").replace("{position}", String(job.queuePosition || 1)),
      locale === "fr"
        ? "Le worker attend un slot libre."
        : "Waiting for a worker slot.",
    ].join("\n");
  }

  if (job.status === "downloading") {
    const webLink = `${appConfig.baseUrl}/track/${jobId}`;
    return [
      getFunnyStatus(jobId, job.progress, job.status),
      `${progressBar(job.progress)} ${job.progress}%`,
      job.progressLabel || (locale === "fr" ? "Traitement en cours..." : "Processing..."),
      "",
      locale === "fr" ? `🔗 Suis ici: ${webLink}` : `🔗 Track here: ${webLink}`,
    ].join("\n");
  }

  if (job.status === "done") {
    return [
      getFunnyStatus(jobId, 100, "done"),
      t(locale, "botReadyLine"),
    ].join("\n");
  }

  return job.error || t(locale, "botDownloadFailed");
}

async function trackJobInChat(bot: Telegraf, ctx: any, choice: PendingChoice, jobId: string, title: string) {
  let lastText = "";

  while (true) {
    const job = getDownloadJob(jobId);
    if (!job) break;

    const nextText = renderJobUpdate(choice.locale, jobId);
    if (nextText !== lastText) {
      await editChoiceMessage(bot, ctx.chat.id, choice, nextText, { inline_keyboard: [] });
      lastText = nextText;
    }

    if (job.status === "done") {
      await sendPresence(ctx, "upload_document");
      await sendDeliveredMedia(bot, ctx.chat.id, choice.locale, jobId, title);
      void processNextInQueue(bot, ctx.from?.id, ctx);
      break;
    }

    if (job.status === "error") {
      await sendPresence(ctx, "typing");
      const errorMsg = job.error || t(choice.locale, "botDownloadFailed");
      await ctx.reply(`❌ Request #${choice.requestId}: ${errorMsg}`, webKeyboard(choice.locale));
      void processNextInQueue(bot, ctx.from?.id, ctx);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function loadAndPrompt(bot: Telegraf, ctx: any, url: string, locale: AppLocale, forcedMode?: DownloadMode, forcedExt?: string | null, requestId: number = 1) {
  await sendPresence(ctx, "typing");
  const loadingMessage = await ctx.reply(`🔍 Request #${requestId}: ${t(locale, "botInspecting")}`);
  const info = await fetchMediaInfo(url);
  const choice: PendingChoice = {
    id: randomUUID().slice(0, 8),
    url,
    info,
    locale,
    requestId,
  };

  pendingByChat.set(ctx.chat.id, choice);
  await safeDeleteMessage(bot, ctx.chat.id, loadingMessage.message_id);

  // Image gallery detected — offer direct images or web app
  if (info.images && info.images.length > 0) {
    // TikTok specific: Auto-send without menu
    if (info.platform === "tiktok") {
      await ctx.reply(`🖼️ TikTok Carousel: ${t(locale, "botProcessingShort")}`);
      
      // 1. Send Images
      await sendImagesGallery(ctx, choice);
      
      // 2. Trigger Audio if exists
      const hasAudio = (info.audioOptions && info.audioOptions.length > 0);
      const isMusicOnly = info.resolvedUrl && (!info.videoOptions || info.videoOptions.length === 0);
      const isTikTok = info.platform === "tiktok";
      
      if (hasAudio || isMusicOnly || isTikTok) {
        // Force audio download for TikTok carousels even if not explicitly in info
        await triggerAudioJob(bot, ctx, choice);
      } else {
        void processNextInQueue(bot, ctx.from?.id, ctx);
      }
      
      pendingByChat.delete(ctx.chat.id);
      return;
    }

    const countLine = `${info.images.length} image${info.images.length > 1 ? "s" : ""}`;
    const webUrl = `${appConfig.baseUrl}?url=${encodeURIComponent(url)}`;
    const refLink = `[Source](${url})`;
    const trackLink = `<a href="${webUrl}">Track</a>`;
    const text = [
      `<b>Request #${requestId}</b>`,
      t(locale, "botImageCarousel"), 
      countLine, 
      escapeHTML(trimTitle(info.title || "")), 
      "", 
      t(locale, "botImageGalleryHint"),
      "",
      `🔗 ${refLink} | 📊 ${trackLink}`
    ]
      .filter(Boolean)
      .join("\n");
    
    // Add options for Video, Audio, and Images
    const inline_keyboard: any[][] = [];
    
    // 1. Video option if present
    if (info.videoOptions && info.videoOptions.length > 0) {
      inline_keyboard.push([{ text: `🎬 ${t(locale, "botVideoLabel")}`, callback_data: `dl:${choice.id}:video:best:mp4` }]);
    }

    // 2. Audio (Music) option if present
    const hasAudio = (info.audioOptions && info.audioOptions.length > 0);
    // For carousels with resolvedUrl but no videoOptions, it's likely just background music
    const isMusicOnly = info.resolvedUrl && (!info.videoOptions || info.videoOptions.length === 0);
    
    if (hasAudio || isMusicOnly) {
      inline_keyboard.push([{ text: `🎧 ${t(locale, "botAudioLabel")}`, callback_data: `dl:${choice.id}:audio:best:mp3` }]);
    }
    
    // 3. Send Images option
    if (info.images && info.images.length > 0) {
      inline_keyboard.push([{ text: t(locale, "botSendImages"), callback_data: `imgs:${choice.id}` }]);
    }

    // 4. Web Gallery option (always last/bottom)
    inline_keyboard.push([{ text: t(locale, "botOpenWebGallery"), url: `${appConfig.baseUrl}?url=${encodeURIComponent(url)}` }]);

    const keyboard = {
      reply_markup: {
        inline_keyboard,
      },
    };
    if (info.thumbnail) {
      await ctx.replyWithPhoto(info.thumbnail, { caption: text, ...keyboard });
    } else {
      await ctx.reply(text, keyboard);
    }
    return;
  }

  if (forcedMode) {
    const activeExt = forcedExt || (forcedMode === "video" ? "mp4" : "mp3");
    await sendChoiceMessage(
      ctx,
      choice,
      buildSelectionMessage(choice, locale, t(locale, "botPreviewReady")),
      qualityKeyboard(choice, forcedMode, activeExt).reply_markup,
    );
    return;
  }

  await sendChoiceMessage(ctx, choice, buildSelectionMessage(choice, locale, t(locale, "botChooseMode")), modeKeyboard(locale).reply_markup);
}

async function replyWelcome(ctx: any, locale: AppLocale) {
  const intro = [statusMessage(locale), t(locale, "botWelcome"), "", helpMessage(locale, isAdmin(ctx.from?.id))].join("\n");
  await sendPresence(ctx, "typing");
  await ctx.reply(intro, { ...modeKeyboard(locale), parse_mode: "HTML" });
}

async function enqueueRequest(bot: Telegraf, ctx: any, url: string, mode: DownloadMode) {
  const userId = ctx.from?.id;
  const locale = localeForTelegram(userId, ctx.from?.language_code);
  if (!userId) return;

  const currentCount = userRequestCounter.get(userId) || 0;
  const nextId = currentCount + 1;
  userRequestCounter.set(userId, nextId);

  const queue = userQueues.get(userId) || [];
  queue.push({ url, mode, requestId: nextId });
  userQueues.set(userId, queue);

  if (!userProcessing.get(userId)) {
    void processNextInQueue(bot, userId, ctx);
  } else {
    await ctx.reply(`⏳ Added to your queue: <b>Request #${nextId}</b>`, { parse_mode: "HTML" });
  }
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
    await ctx.reply(helpMessage(locale, isAdmin(ctx.from?.id)), { ...modeKeyboard(locale), parse_mode: "HTML" });
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

  bot.command("server", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(await getServerHealthText(), webKeyboard(locale));
  });

  bot.command("queue", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      return;
    }

    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    await ctx.reply(await getQueueSnapshotText(), webKeyboard(locale));
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

    void enqueueRequest(bot, ctx, request.url, "video");
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

    void enqueueRequest(bot, ctx, request.url, "audio");
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
      const preferredMode = modeByChat.get(ctx.chat.id) || getUserPreferences(ctx.from?.id).mode || "video";
      void enqueueRequest(bot, ctx, url, preferredMode);
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(locale, "botDownloadFailed"), webKeyboard(locale));
    }
  });

  bot.action(/lang:(en|fr)/, async (ctx) => {
    const locale = ctx.match[1] as AppLocale;
    rememberUser(ctx.from?.id);
    setUserLocale(ctx.from?.id, locale);
    await ctx.answerCbQuery(t(locale, "botLanguageSaved").split(".")[0]);
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
      await ctx.answerCbQuery().catch(() => {});
      return;
    }
    await ctx.answerCbQuery(locale === "fr" ? "Retour au mode" : "Back to mode");
    await editChoiceMessage(bot, chatId, choice, promptForMode(locale, choice.info.title), modeKeyboard(locale).reply_markup);
  });

  bot.action(/back:ext:([a-z0-9]+):(video|audio)/, async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    const chatId = ctx.chat?.id;
    const choice = chatId ? pendingByChat.get(chatId) : null;
    if (!chatId || !choice) {
      await ctx.answerCbQuery().catch(() => {});
      return;
    }
    const mode = ctx.match[2] as DownloadMode;
    await ctx.answerCbQuery(locale === "fr" ? "Retour au format" : "Back to format").catch(() => {});
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, t(choice.locale, "botChooseFormat")), extensionKeyboard(choice, mode).reply_markup);
  });

  bot.action(/mode:(video|audio)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery().catch(() => {});
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

    await ctx.answerCbQuery(locale === "fr" ? "Choisis le format" : "Choose format").catch(() => {});
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, t(choice.locale, "botChooseFormat")), extensionKeyboard(choice, mode).reply_markup);
  });

  bot.action(/ext:([a-z0-9]+):(video|audio):(mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery().catch(() => {});
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
    await ctx.answerCbQuery(ext.toUpperCase()).catch(() => {});
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, t(choice.locale, "botChooseQuality")), qualityKeyboard(choice, mode, ext).reply_markup);
  });

  bot.action(/dl:([a-z0-9]+):(video|audio):(best|[0-9A-Za-z_-]+):(default|mp4|webm|mkv|mp3|m4a)/, async (ctx) => {
    if (shouldGateForMaintenance(ctx.from?.id)) {
      const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
      await ctx.answerCbQuery().catch(() => {});
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

    // Use specific audio label if it's an audio download and we have a format match
    const audioOption = mode === "audio" ? choice.info.audioOptions.find(o => o.id === selectedFormatId) : null;
    const jobTitle = audioOption ? audioOption.label : choice.info.title;

    // Answer immediately
    await ctx.answerCbQuery(t(choice.locale, "botProcessingShort")).catch(() => {});

    // Remove buttons and show state (Processing...)
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`), { inline_keyboard: [] });

    if (mode === "audio") {
      await triggerAudioJob(bot, ctx, choice, selectedFormatId);
      return;
    }

    try {
      const job = createDownloadJob({
        url: choice.url,
        mode,
        formatId: selectedFormatId === "best" ? null : selectedFormatId,
        targetExt,
        title: jobTitle,
        source: "bot",
        // For video mode: prefer resolvedVideoUrl (tikwm direct), fall back to resolvedUrl
        resolvedUrl: mode === "video"
          ? (choice.info.resolvedVideoUrl || choice.info.resolvedUrl)
          : choice.info.resolvedUrl,
        thumbnail: choice.info.thumbnail,
      });

      pendingByChat.delete(chatId);
      void trackJobInChat(bot, ctx, choice, job.id, jobTitle || t(choice.locale, "botExportFallbackTitle"));
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    }
  });

  bot.action(/imgs:([a-z0-9]+)/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const [, pendingId] = ctx.match;
    const choice = pendingByChat.get(chatId);

    if (!choice || choice.id !== pendingId || !choice.info.images) {
      await ctx.answerCbQuery("Expired.").catch(() => {});
      return;
    }

    await ctx.answerCbQuery(t(choice.locale, "botProcessingShort")).catch(() => {});
    
    // Remove buttons and show state
    await editChoiceMessage(bot, chatId, choice, buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`), { inline_keyboard: [] });

    await sendImagesGallery(ctx, choice);
  });
}
