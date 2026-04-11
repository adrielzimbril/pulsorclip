import { Telegraf } from "telegraf";
import { appConfig, logServer } from "@pulsorclip/core/server";

type BotCommand = {
  command: string;
  description: string;
};

type CommandScope =
  | { type: "default" }
  | { type: "all_private_chats" }
  | { type: "chat"; chat_id: number };

async function safeTelegramCall<T = unknown>(
  bot: Telegraf,
  method: string,
  payload?: Record<string, unknown>,
): Promise<T | null> {
  try {
    const result = await bot.telegram.callApi(method as never, (payload || {}) as never);
    logServer("info", "bot.metadata.call.ok", {
      method,
      payload,
    });
    return result as T;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    logServer("error", "bot.metadata.call.failed", {
      method,
      payload,
      reason: details,
    });
    return null;
  }
}

const publicEnglishCommands: BotCommand[] = [
  { command: "start", description: "Start the guided PulsorClip flow" },
  { command: "language", description: "Choose the bot language" },
  { command: "help", description: "Show commands and examples" },
  { command: "video", description: "Download video from a URL" },
  { command: "audio", description: "Download audio from a URL" },
  { command: "mp4", description: "Save video mode, then send a URL" },
  { command: "mp3", description: "Save audio mode, then send a URL" },
  { command: "formats", description: "List supported download formats" },
  { command: "queue", description: "Show your queue and cancel waiting items" },
];

const publicFrenchCommands: BotCommand[] = [
  { command: "start", description: "Demarrer le flow guide PulsorClip" },
  { command: "language", description: "Choisir la langue du bot" },
  { command: "help", description: "Afficher les commandes et exemples" },
  { command: "video", description: "Telecharger une video depuis une URL" },
  { command: "audio", description: "Telecharger un audio depuis une URL" },
  { command: "mp4", description: "Memoriser le mode video puis envoyer une URL" },
  { command: "mp3", description: "Memoriser le mode audio puis envoyer une URL" },
  { command: "formats", description: "Lister les formats pris en charge" },
  { command: "queue", description: "Voir ta file et annuler les elements en attente" },
];

const adminEnglishCommands: BotCommand[] = [
  ...publicEnglishCommands,
  { command: "status", description: "Check live bot and web counters" },
  { command: "server", description: "Show full server diagnostics" },
  { command: "health", description: "Send a health snapshot to admins" },
  { command: "report", description: "Show the current daily report" },
  { command: "daily", description: "Send the daily summary now" },
];

const adminFrenchCommands: BotCommand[] = [
  ...publicFrenchCommands,
  { command: "status", description: "Voir les compteurs live bot et web" },
  { command: "server", description: "Voir le diagnostic serveur complet" },
  { command: "health", description: "Envoyer un point sante aux admins" },
  { command: "report", description: "Voir le rapport journalier courant" },
  { command: "daily", description: "Envoyer le recap journalier maintenant" },
];

async function setCommands(
  bot: Telegraf,
  commands: BotCommand[],
  scope: CommandScope,
  languageCode?: string,
) {
  await safeTelegramCall(bot, "deleteMyCommands", {
    scope,
    ...(languageCode ? { language_code: languageCode } : {}),
  });
  await safeTelegramCall(bot, "setMyCommands", {
    commands,
    scope,
    ...(languageCode ? { language_code: languageCode } : {}),
  });

  const current = await safeTelegramCall<BotCommand[]>(bot, "getMyCommands", {
    scope,
    ...(languageCode ? { language_code: languageCode } : {}),
  });

  logServer("info", "bot.metadata.commands.snapshot", {
    scope,
    languageCode: languageCode || "default",
    count: current?.length || 0,
    commands: current?.map((item) => item.command) || [],
  });
}

async function syncDescriptions(bot: Telegraf) {
  const botName = "Pulsor Clip - Media Downloader (TikTok, Instagram, YT & more)";

  await safeTelegramCall(bot, "setMyName", {
    name: botName,
  });
  await safeTelegramCall(bot, "setMyName", {
    language_code: "fr",
    name: botName,
  });

  const descPrefix = "Dev: https://t.me/akaiokami_az\n\n";

  await safeTelegramCall(bot, "setMyDescription", {
    description: `${descPrefix}Send a media link, choose the format, and receive the prepared file in Telegram or continue in the web app.`,
  });
  await safeTelegramCall(bot, "setMyDescription", {
    language_code: "fr",
    description: `${descPrefix}Envoie un lien media, choisis le format, puis recois le fichier prepare dans Telegram ou continue dans l app web si le fichier est trop lourd.`,
  });

  await safeTelegramCall(bot, "setMyShortDescription", {
    short_description: "Download videos and audio. Dev: @akaiokami_az",
  });
  await safeTelegramCall(bot, "setMyShortDescription", {
    language_code: "fr",
    short_description: "Telechargement videos et audio. Dev: @akaiokami_az",
  });

  const description = await safeTelegramCall<{ description: string }>(bot, "getMyDescription");
  const shortDescription = await safeTelegramCall<{ short_description: string }>(bot, "getMyShortDescription");

  logServer("info", "bot.metadata.description.snapshot", {
    description: description?.description || null,
    shortDescription: shortDescription?.short_description || null,
  });
}

export async function applyTelegramMetadata(bot: Telegraf) {
  await setCommands(bot, publicEnglishCommands, { type: "default" });
  await setCommands(bot, publicFrenchCommands, { type: "default" }, "fr");
  await setCommands(bot, publicEnglishCommands, { type: "all_private_chats" });
  await setCommands(bot, publicFrenchCommands, { type: "all_private_chats" }, "fr");

  for (const adminId of appConfig.telegramAdminIds) {
    await setCommands(bot, adminEnglishCommands, {
      type: "chat",
      chat_id: adminId,
    });
    await setCommands(
      bot,
      adminFrenchCommands,
      {
        type: "chat",
        chat_id: adminId,
      },
      "fr",
    );
  }

  await syncDescriptions(bot);

  await safeTelegramCall(bot, "setChatMenuButton", {
    menu_button: {
      type: "commands",
    },
  });
}
