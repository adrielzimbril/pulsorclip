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
  cancelDownloadJob,
} from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { type AppLocale, type DownloadMode, type MediaInfo } from "@pulsorclip/core/shared";
import { qualityKeyboard, languageKeyboard, modeKeyboard, webKeyboard, extensionKeyboard, trackKeyboard } from "./keyboards";
import { getCurrentDailySummaryText, getQueueSnapshotText, getServerHealthText, sendDailySnapshot, sendHealthSnapshot } from "./monitoring";
import { getUserPreferences, setUserLocale, setUserMode } from "./preferences";
import { modeByChat, pendingByChat, userActiveRequest, userQueues, userProcessing, userRequestCounter } from "./state";
import type { PendingChoice, QueuedRequest } from "./types";
import { firstHttpUrl, isAdmin, localeForTelegram, shouldGateForMaintenance, shouldGateForPublicAccess, escapeHTML } from "./utils";

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
    "/video <media_url>",
    "/audio <media_url>",
    "/mp4",
    "/mp3",
    "/formats",
    "/queue",
    "/language",
  ];

  const lines = [
    `<b>${escapeHTML(t(locale, "botHelpIntro"))}</b>`,
    locale === "fr"
      ? "Colle un lien, choisis video ou audio, puis je gere la file et je t envoie le resultat ici quand Telegram le permet."
      : "Paste a link, choose video or audio, then I handle the queue and send the result here when Telegram allows it.",
    "",
    `<b>${locale === "fr" ? "Demarrage rapide" : "Quick start"}</b>`,
    locale === "fr"
      ? "1. Envoie une URL media\n2. Choisis le format\n3. Choisis la qualite\n4. Attends le fichier ou ouvre le suivi web"
      : "1. Send a media URL\n2. Pick the format\n3. Pick the quality\n4. Wait for the file or open the web tracker",
    "",
    `<b>${escapeHTML(t(locale, "botHelpShortcutsLine"))}</b>`,
    ...shortcuts.map((item) => `• ${escapeHTML(item)}`),
  ];

  if (admin) {
    lines.push("", `<b>${locale === "fr" ? "Commandes admin" : "Admin commands"}</b>`);
    lines.push(...["/queuestatus", "/status", "/server", "/health", "/report", "/daily"].map((item) => `• ${escapeHTML(item)}`));
  }

  lines.push("", t(locale, "botHelpGuidance"));
  return lines.join("\n");
}

function adminHelpMessage(locale: AppLocale) {
  const title = locale === "fr" ? "Commandes admin" : "Admin commands";
  const body =
    locale === "fr"
      ? "Ces commandes servent au pilotage et au diagnostic du bot."
      : "These commands are for bot operations and diagnostics.";

  return [
    `<b>${title}</b>`,
    body,
    "",
    "• /queuestatus",
    "• /status",
    "• /server",
    "• /health",
    "• /report",
    "• /daily",
  ].join("\n");
}

function publicUnavailableMessage(locale: AppLocale) {
  return locale === "fr"
    ? "Le bot est actuellement indisponible pour le public. Seuls les admins peuvent l utiliser pour le moment."
    : "The bot is currently unavailable to the public. Only admins can use it right now.";
}

function promptForMode(locale: AppLocale, title?: string) {
  const prefix = title ? `${title}\n\n` : "";
  return `${prefix}${t(locale, "botChooseMode")}`;
}

function sendUrlPrompt(locale: AppLocale, mode: DownloadMode) {
  if (locale === "fr") {
    return mode === "video"
      ? "<b>Mode video active.</b>\nEnvoie un lien media.\n\nJe te proposerai ensuite le format puis la qualite."
      : "<b>Mode audio active.</b>\nEnvoie un lien media.\n\nJe te proposerai ensuite le format puis la qualite.";
  }

  return mode === "video"
    ? "<b>Video mode enabled.</b>\nSend one media link.\n\nI will guide you through format and quality next."
    : "<b>Audio mode enabled.</b>\nSend one media link.\n\nI will guide you through format and quality next.";
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

function buildSelectionMessage(choice: PendingChoice, locale: AppLocale, statusText: string, jobId?: string) {
  const meta = choice.info;
  const sourceLink = `<a href="${choice.url}">Source</a>`;
  const trackLine = jobId ? ` | 📊 <a href="${appConfig.baseUrl}/track/${jobId}">Track</a>` : "";

  return [
    `<b>Request #${choice.requestId}</b>`,
    statusText,
    escapeHTML(trimTitle(meta.title || "")),
    meta.description ? `\n📝 ${escapeHTML(meta.description.substring(0, 200))}` : "",
    meta.tags && meta.tags.length > 0 ? `\n🏷️ ${meta.tags.slice(0, 5).map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ')}` : "",
    `\n🔗 ${sourceLink}${trackLine}`,
  ].filter(Boolean).join("\n");
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
    await bot.telegram.sendMessage(chatId, t(locale, "botDownloadFailed"), trackKeyboard(locale, jobId));
    return;
  }

  if (statSync(file.filePath).size > appConfig.telegramUploadLimitBytes) {
    await bot.telegram.sendMessage(chatId, t(locale, "botTooLarge"), trackKeyboard(locale, jobId));
    return;
  }

  const extension = extname(file.filename).toLowerCase();
  const finalCaption = `<b>Request #${job.source === "bot" ? (job as any).requestId || "?" : "?"}</b>\n${escapeHTML(title)}${job.description ? `\n\n📝 ${escapeHTML(job.description.substring(0, 200))}` : ""}${job.tags && job.tags.length > 0 ? `\n\n🏷️ ${job.tags.slice(0, 5).map(t => "#"+t.replace(/\s+/g, '_')).join(' ')}` : ""}\n\n🔗 <a href="${job.url}">Source</a> | 📊 <a href="${appConfig.baseUrl}/track/${jobId}">Track</a>`;
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

async function triggerAudioJob(bot: Telegraf, ctx: any, choice: PendingChoice, formatId: string = "best", silent: boolean = false) {
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
      description: choice.info.description,
      tags: choice.info.tags,
    });
    
    (job as any).requestId = choice.requestId;

    if (choice.messageId && !silent) {
      await editChoiceMessage(
        bot,
        ctx.chat.id,
        choice,
        buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`, job.id),
        { inline_keyboard: [] },
      );
    }

    pendingByChat.delete(ctx.chat.id);
    
    // Update active request with jobId for cancellation support
    const userId = ctx.from?.id;
    if (userId) {
      const active = userActiveRequest.get(userId);
      if (active && active.requestId === choice.requestId) {
        userActiveRequest.set(userId, { ...active, jobId: job.id });
      } else {
        // Direct trigger without coming from formal queue shift
        userActiveRequest.set(userId, {
          url: choice.url,
          mode: "audio",
          requestId: choice.requestId,
          info: choice.info,
          jobId: job.id
        });
      }
    }

    if (!choice.messageId && !silent) {
       await ctx.reply(`🎧 ${t(choice.locale, "botAudioLabel")}: ${t(choice.locale, "botProcessingShort")}`);
    }

    void trackJobInChat(bot, ctx, choice, job.id, jobTitle || t(choice.locale, "botExportFallbackTitle"), silent);
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    void processNextInQueue(bot, ctx.from?.id, ctx);
  }
}

async function triggerVideoJob(bot: Telegraf, ctx: any, choice: PendingChoice, formatId: string = "best", targetExt: string = "mp4", silent: boolean = false) {
  const jobTitle = choice.info.title;

  try {
    const job = createDownloadJob({
      url: choice.url,
      mode: "video",
      formatId: formatId === "best" ? null : formatId,
      targetExt,
      title: jobTitle,
      source: "bot",
      resolvedUrl: choice.info.resolvedVideoUrl || choice.info.resolvedUrl,
      thumbnail: choice.info.thumbnail,
      description: choice.info.description,
      tags: choice.info.tags,
    });
    
    (job as any).requestId = choice.requestId;

    if (choice.messageId && !silent) {
      await editChoiceMessage(
        bot,
        ctx.chat.id,
        choice,
        buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`, job.id),
        { inline_keyboard: [] },
      );
    }

    pendingByChat.delete(ctx.chat.id);
    
    // Update active request with jobId for cancellation support
    const userId = ctx.from?.id;
    if (userId) {
      const active = userActiveRequest.get(userId);
      if (active && active.requestId === choice.requestId) {
        userActiveRequest.set(userId, { ...active, jobId: job.id });
      } else {
        // Direct trigger without coming from formal queue shift
        userActiveRequest.set(userId, {
          url: choice.url,
          mode: "video",
          requestId: choice.requestId,
          info: choice.info,
          jobId: job.id
        });
      }
    }

    if (!choice.messageId && !silent) {
       await ctx.reply(`🎬 ${t(choice.locale, "botVideoLabel")}: ${t(choice.locale, "botProcessingShort")}`);
    }

    void trackJobInChat(bot, ctx, choice, job.id, jobTitle || t(choice.locale, "botExportFallbackTitle"), silent);
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    void processNextInQueue(bot, ctx.from?.id, ctx);
  }
}

async function processNextInQueue(bot: Telegraf, userId: number, ctx: any) {
  const queue = userQueues.get(userId) || [];
  if (queue.length === 0) {
    userProcessing.set(userId, false);
    userActiveRequest.set(userId, null);
    return;
  }

  userProcessing.set(userId, true);
  const request = queue.shift()!;
  userQueues.set(userId, queue);
  userActiveRequest.set(userId, request);

  const locale = localeForTelegram(userId, ctx.from?.language_code);
  try {
    await loadAndPrompt(bot, ctx, request.url, locale, request.mode, null, request.requestId, request.info);
  } catch (error) {
    await ctx.reply(`❌ Request #${request.requestId}: ${error instanceof Error ? error.message : t(locale, "botDownloadFailed")}`);
    userActiveRequest.set(userId, null);
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
      await ctx.replyWithMediaGroup(
        chunk.map((url: string, idx: number) => ({
          type: "photo",
          media: url,
          caption: idx === 0 ? `<b>Request #${choice.requestId}</b>\n${escapeHTML(choice.info.title || "")}${choice.info.description ? `\n\n📝 ${escapeHTML(choice.info.description.substring(0, 200))}` : ""}${choice.info.tags && choice.info.tags.length > 0 ? `\n\n🏷️ ${choice.info.tags.slice(0, 5).map(t => "#"+t.replace(/\s+/g, '_')).join(' ')}` : ""}\n\n🔗 <a href="${choice.url}">Source</a>` : undefined,
          parse_mode: "HTML",
        }))
      );
      // Small delay to avoid flood
      if (i + 10 < validatedImages.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // await ctx.reply(`✅ ${t(locale, "botImagesSent")}`, webKeyboard(locale));
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

function serverJobUpdate(locale: AppLocale, jobId: string) {
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

async function trackJobInChat(bot: Telegraf, ctx: any, choice: PendingChoice, jobId: string, title: string, silent: boolean = false) {
  let lastText = "";

  while (true) {
    const job = getDownloadJob(jobId);
    if (!job) break;

    const nextText = serverJobUpdate(choice.locale, jobId);
    if (!silent && nextText !== lastText) {
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
      const statusLine = choice.locale === "fr" 
        ? `Requête #${choice.requestId} échouée et retirée de la file`
        : `Request #${choice.requestId} failed and removed from queue`;

      await ctx.reply(
        [
          `❌ Oops... ${job.error || (choice.locale === "fr" ? "Échec du téléchargement" : "Download failed")}`,
          `<b>${statusLine}</b>`,
          "",
          escapeHTML(trimTitle(title)),
          `🔗 ${choice.url}`,
          choice.locale === "fr"
            ? "\nTu peux réessayer ce lien plus tard."
            : "\nYou can retry this link later.",
        ].join("\n"),
        { ...trackKeyboard(choice.locale, jobId), parse_mode: "HTML" },
      );
      void processNextInQueue(bot, ctx.from?.id, ctx);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function loadAndPrompt(bot: Telegraf, ctx: any, url: string, locale: AppLocale, forcedMode?: DownloadMode, forcedExt?: string | null, requestId: number = 1, providedInfo?: MediaInfo) {
  await sendPresence(ctx, "typing");
  const loadingMessage = await ctx.reply(`🔍 Request #${requestId}: ${t(locale, "botInspecting")}`);
  const info = providedInfo || await fetchMediaInfo(url);
  const choice: PendingChoice = {
    id: randomUUID().slice(0, 8),
    url,
    info,
    locale,
    requestId,
  };

  pendingByChat.set(ctx.chat.id, choice);
  await safeDeleteMessage(bot, ctx.chat.id, loadingMessage.message_id);

  if (info.playlist && info.playlist.entries.length > 0) {
    const text = [
      `<b>Request #${requestId}</b>`,
      t(locale, "botPlaylistDetected"),
      `${info.playlist.entries.length} items`,
      escapeHTML(trimTitle(info.playlist.title || info.title || "")),
      "",
      t(locale, "botPlaylistHint"),
    ]
      .filter(Boolean)
      .join("\n");

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: t(locale, "botQueuePlaylistVideo"), callback_data: `pl:${choice.id}:video` }],
          [{ text: t(locale, "botQueuePlaylistAudio"), callback_data: `pl:${choice.id}:audio` }],
          [{ text: t(locale, "botOpenWebPlaylist"), url: `${appConfig.baseUrl}?url=${encodeURIComponent(url)}` }],
        ],
      },
    };

    if (info.thumbnail) {
      await ctx.replyWithPhoto(info.thumbnail, { caption: text, ...keyboard, parse_mode: "HTML" });
    } else {
      await ctx.reply(text, { ...keyboard, parse_mode: "HTML" });
    }
    return;
  }

  // Image gallery detected — offer direct images or web app
  if (info.images && info.images.length > 0) {
    // TikTok specific: Auto-send without menu
    if (info.platform === "tiktok") {
      const hasAudioSource = Boolean(
        info.resolvedUrl ||
        (info.audioOptions && info.audioOptions.length > 0),
      );

      const msg = hasAudioSource 
        ? `🔥 ${t(locale, "botProcessingShort")} (Gallery + Audio)`
        : `🖼️ ${t(locale, "botImagesSent")}: ${t(locale, "botProcessingShort")}`;

      await ctx.reply(msg);
      
      if (hasAudioSource) {
        void triggerAudioJob(bot, ctx, choice, "best", true);
      }

      await sendImagesGallery(ctx, choice);

      if (!hasAudioSource) {
        void processNextInQueue(bot, ctx.from?.id, ctx);
      }
      
      pendingByChat.delete(ctx.chat.id);
      return;
    }

    const countLine = `${info.images.length} image${info.images.length > 1 ? "s" : ""}`;
    const refLink = `<a href="${url}">Source</a>`;
    const text = [
      `<b>Request #${requestId}</b>`,
      t(locale, "botImageCarousel"), 
      countLine, 
      escapeHTML(trimTitle(info.title || "")), 
      "", 
      t(locale, "botImageGalleryHint"),
      "",
      `🔗 ${refLink}`
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
  const welcome =
    locale === "fr"
      ? "<b>PulsorClip est pret.</b>\nEnvoie un lien media et je te guide etape par etape."
      : "<b>PulsorClip is ready.</b>\nSend one media link and I will guide you step by step.";
  const intro = [statusMessage(locale), welcome, "", helpMessage(locale)].join("\n");
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

  const info = await fetchMediaInfo(url).catch(() => undefined);
  const queue = userQueues.get(userId) || [];
  queue.push({ url, mode, requestId: nextId, info });
  userQueues.set(userId, queue);

  if (!userProcessing.get(userId)) {
    void processNextInQueue(bot, userId, ctx);
  } else {
    await ctx.reply(`⏳ Added to your queue: <b>Request #${nextId}</b>`, { parse_mode: "HTML" });
  }
}

async function enqueuePlaylistRequests(bot: Telegraf, ctx: any, choice: PendingChoice, mode: DownloadMode) {
  const userId = ctx.from?.id;
  if (!userId || !choice.info.playlist?.entries?.length) {
    return;
  }

  const locale = localeForTelegram(userId, ctx.from?.language_code);
  const queue = userQueues.get(userId) || [];
  let currentCount = userRequestCounter.get(userId) || 0;

  for (const entry of choice.info.playlist.entries) {
    currentCount += 1;
    queue.push({
      url: entry.url,
      mode,
      requestId: currentCount,
    });
  }

  userRequestCounter.set(userId, currentCount);
  userQueues.set(userId, queue);

  if (!userProcessing.get(userId)) {
    void processNextInQueue(bot, userId, ctx);
  }

  await ctx.reply(
    t(locale, "playlistQueued").replace("{count}", String(choice.info.playlist.entries.length)),
    webKeyboard(locale),
  );
}

function userQueueKeyboard(userId: number, locale: AppLocale) {
  const active = userActiveRequest.get(userId);
  const queue = userQueues.get(userId) || [];
  
  const buttons: any[][] = [];

  // Active job cancellation
  if (active && active.jobId) {
    buttons.push([
      { text: `🛑 Stop Active #${active.requestId}`, callback_data: `cancelactive:${active.jobId}` },
    ]);
  }

  // Queued jobs cancellation
  if (queue.length > 0) {
    buttons.push(...queue.slice(0, 8).map((request) => [
      { text: `❌ Cancel #${request.requestId}`, callback_data: `uqcancel:${request.requestId}` },
    ]));
  }

  buttons.push([{ text: "🌐 Open web", url: appConfig.baseUrl }]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

function getRequestTypeLabel(request: QueuedRequest) {
  if (!request.info) return request.mode.toUpperCase();
  const info = request.info;
  if (info.playlist) return "PLAYLIST";
  if (info.images && info.images.length > 0) return "IMAGES";
  if (info.audioOptions && info.audioOptions.length > 0 && (!info.videoOptions || info.videoOptions.length === 0)) return "AUDIO";
  return "VIDEO";
}

function userQueueMessage(userId: number, locale: AppLocale) {
  const active = userActiveRequest.get(userId);
  const queue = userQueues.get(userId) || [];

  const lines = [
    locale === "fr" ? "📦 Ta file" : "📦 Your queue",
    "",
    active
      ? locale === "fr"
        ? `▶️ En cours: #${active.requestId} · ${getRequestTypeLabel(active)}` + (active.jobId ? " (Traitement)" : " (Initialisation)")
        : `▶️ Active: #${active.requestId} · ${getRequestTypeLabel(active)}` + (active.jobId ? " (Processing)" : " (Initializing)")
      : locale === "fr"
        ? "▶️ En cours: aucun job actif"
        : "▶️ Active: no job processing right now",
  ];

  if (queue.length === 0) {
    lines.push(
      "",
      locale === "fr"
        ? "Aucun élément en attente. Envoie un lien pour relancer la file."
        : "Nothing is waiting. Send a link to refill the queue.",
    );
    return lines.join("\n");
  }

  lines.push(
    "",
    ...(queue.slice(0, 8).map((request, index) =>
      `${index + 1}. #${request.requestId} · ${getRequestTypeLabel(request)} · ${request.url}`,
    )),
  );

  if (queue.length > 8) {
    lines.push(locale === "fr" ? `… et ${queue.length - 8} autres.` : `… and ${queue.length - 8} more.`);
  }

  lines.push(
    "",
    locale === "fr"
      ? "Utilise les boutons ci-dessous pour annuler les éléments encore en attente."
      : "Use the buttons below to cancel items that are still waiting.",
  );

  return lines.join("\n");
}

export function registerBotHandlers(bot: Telegraf) {
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const locale = localeForTelegram(userId, ctx.from?.language_code);

    if (!shouldGateForPublicAccess(userId)) {
      return next();
    }

    if ("answerCbQuery" in ctx) {
      await ctx.answerCbQuery(publicUnavailableMessage(locale)).catch(() => {});
    }

    if ("reply" in ctx) {
      await ctx.reply(publicUnavailableMessage(locale));
    }

    return;
  });

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
    await ctx.reply(helpMessage(locale), { ...modeKeyboard(locale), parse_mode: "HTML" });
    if (isAdmin(ctx.from?.id)) {
      await ctx.reply(adminHelpMessage(locale), { parse_mode: "HTML" });
    }
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
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    await sendPresence(ctx, "typing");
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(locale === "fr" ? "Utilisateur introuvable." : "User not found.");
      return;
    }

    const personalMessage = userQueueMessage(userId, locale);

    if (isAdmin(ctx.from?.id)) {
      const serverSnapshot = await getQueueSnapshotText();
      await ctx.reply([personalMessage, "", serverSnapshot].join("\n"), userQueueKeyboard(userId, locale));
      return;
    }

    await ctx.reply(personalMessage, userQueueKeyboard(userId, locale));
  });

  bot.command("queuestatus", async (ctx) => {
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
    const text =
      locale === "fr"
        ? "<b>Formats disponibles</b>\n🎬 Video : <code>MP4</code>, <code>WEBM</code>, <code>MKV</code>\n🎧 Audio : <code>MP3</code>, <code>M4A</code>"
        : "<b>Available formats</b>\n🎬 Video: <code>MP4</code>, <code>WEBM</code>, <code>MKV</code>\n🎧 Audio: <code>MP3</code>, <code>M4A</code>";
    await ctx.reply(text, { ...webKeyboard(locale), parse_mode: "HTML" });
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
      await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, { ...webKeyboard(locale), parse_mode: "HTML" });
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
      await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, { ...webKeyboard(locale), parse_mode: "HTML" });
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
    await ctx.reply(`🎬 ${sendUrlPrompt(locale, "video")}`, { ...webKeyboard(locale), parse_mode: "HTML" });
  });

  bot.command("mp3", async (ctx) => {
    const locale = localeForTelegram(ctx.from?.id, ctx.from?.language_code);
    rememberUser(ctx.from?.id);
    modeByChat.set(ctx.chat.id, "audio");
    setUserMode(ctx.from?.id, "audio");
    await sendPresence(ctx, "typing");
    await ctx.reply(`🎧 ${sendUrlPrompt(locale, "audio")}`, { ...webKeyboard(locale), parse_mode: "HTML" });
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
    const welcome =
      locale === "fr"
        ? "<b>PulsorClip est pret.</b>\nEnvoie un lien media et je te guide etape par etape."
        : "<b>PulsorClip is ready.</b>\nSend one media link and I will guide you step by step.";
    try {
      await ctx.editMessageText([t(locale, "botLanguageSaved"), "", welcome].join("\n"), { ...modeKeyboard(locale), parse_mode: "HTML" });
    } catch {
      await ctx.reply([t(locale, "botLanguageSaved"), "", welcome].join("\n"), { ...modeKeyboard(locale), parse_mode: "HTML" });
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
      await ctx.reply(sendUrlPrompt(locale, mode), { ...webKeyboard(locale), parse_mode: "HTML" });
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

      await editChoiceMessage(
        bot,
        chatId,
        choice,
        buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`, job.id),
        { inline_keyboard: [] },
      );

      pendingByChat.delete(chatId);
      void trackJobInChat(bot, ctx, choice, job.id, jobTitle || t(choice.locale, "botExportFallbackTitle"));
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : t(choice.locale, "botDownloadFailed"), webKeyboard(choice.locale));
    }
  });

  bot.action(/pl:([a-z0-9]+):(video|audio)/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const [, pendingId, rawMode] = ctx.match;
    const choice = pendingByChat.get(chatId);

    if (!choice || choice.id !== pendingId || !choice.info.playlist?.entries?.length) {
      await ctx.answerCbQuery("Expired.").catch(() => {});
      return;
    }

    await ctx.answerCbQuery(t(choice.locale, "botProcessingShort")).catch(() => {});
    await editChoiceMessage(
      bot,
      chatId,
      choice,
      buildSelectionMessage(choice, choice.locale, `⏳ ${t(choice.locale, "botProcessing")}`),
      { inline_keyboard: [] },
    );
    pendingByChat.delete(chatId);
    await enqueuePlaylistRequests(bot, ctx, choice, rawMode as DownloadMode);
  });

  bot.action(/uqcancel:(\d+)/, async (ctx) => {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) {
      return;
    }

    const requestId = Number(ctx.match[1]);
    const locale = localeForTelegram(userId, ctx.from?.language_code);
    const queue = userQueues.get(userId) || [];
    const nextQueue = queue.filter((request) => request.requestId !== requestId);

    if (nextQueue.length === queue.length) {
      await ctx.answerCbQuery(locale === "fr" ? "Déjà lancé ou introuvable." : "Already started or not found.").catch(() => {});
      return;
    }

    userQueues.set(userId, nextQueue);
    await ctx.answerCbQuery(locale === "fr" ? `Élément #${requestId} annulé.` : `Item #${requestId} cancelled.`).catch(() => {});
    await ctx.editMessageText(userQueueMessage(userId, locale), {
      ...userQueueKeyboard(userId, locale),
    }).catch(() => {});
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

  bot.action(/cancelactive:(.+)/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const jobId = ctx.match[1];
    const locale = localeForTelegram(userId, ctx.from?.language_code);
    
    try {
      const success = cancelDownloadJob(jobId);
      if (success) {
        await ctx.answerCbQuery(locale === "fr" ? "Job actif arrêté." : "Active job stopped.").catch(() => {});
        // After cancellation, the job status will transition to error/cancelled,
        // and trackJobInChat will naturally handle the exit and processNextInQueue.
        
        // Refresh the queue message if we were in the queue view
        await ctx.editMessageText(userQueueMessage(userId, locale), {
          ...userQueueKeyboard(userId, locale),
        }).catch(() => {});
      } else {
        await ctx.answerCbQuery(locale === "fr" ? "Job non trouvé ou déjà fini." : "Job not found or already finished.").catch(() => {});
      }
    } catch (error) {
      logServer("error", "bot.action.cancelactive.failed", { jobId, error: String(error) });
      await ctx.answerCbQuery("Error stopping job.").catch(() => {});
    }
  });
}
