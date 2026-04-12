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
): Promise<T> {
  logServer("info", "bot.metadata.call.started", {
    method,
    payload,
  });

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
    // Throwing ensures runBootstrapStep catches the failure and stops the sequence
    throw new Error(`Telegram API call ${method} failed: ${details}`);
  }
}


const publicEnglishBaseCommands: BotCommand[] = [
  { command: "start", description: "🚀 Start the guided PulsorClip flow" },
  { command: "language", description: "🌐 Choose the bot language" },
  { command: "help", description: "🧭 Show commands and examples" },
  { command: "video", description: "🎬 Download video from a URL" },
  { command: "audio", description: "🎧 Download audio from a URL" },
  { command: "mp4", description: "📦 Save video mode, then send a URL" },
  { command: "mp3", description: "🎵 Save audio mode, then send a URL" },
  { command: "formats", description: "🧱 List supported download formats" },
  { command: "support", description: "🤝 Get help or contact the operator" },
];

const publicEnglishCommands: BotCommand[] = [
  ...publicEnglishBaseCommands,
  { command: "queue", description: "📦 Show your queue and cancel waiting items" },
];

const publicFrenchBaseCommands: BotCommand[] = [
  { command: "start", description: "🚀 Démarrer le flow guidé PulsorClip" },
  { command: "language", description: "🌐 Choisir la langue du bot" },
  { command: "help", description: "🧭 Afficher les commandes et exemples" },
  { command: "video", description: "🎬 Télécharger une vidéo depuis une URL" },
  { command: "audio", description: "🎧 Télécharger un audio depuis une URL" },
  { command: "mp4", description: "📦 Mémoriser le mode vidéo puis envoyer une URL" },
  { command: "mp3", description: "🎵 Mémoriser le mode audio puis envoyer une URL" },
  { command: "formats", description: "🧱 Lister les formats pris en charge" },
  { command: "support", description: "🤝 Obtenir de l'aide ou contacter l'opérateur" },
];

const publicFrenchCommands: BotCommand[] = [
  ...publicFrenchBaseCommands,
  { command: "queue", description: "📦 Voir ta file et annuler les éléments en attente" },
];

const adminEnglishCommands: BotCommand[] = [
  ...publicEnglishCommands,
  { command: "queuestatus", description: "🗂️ Show the server queue snapshot" },
  { command: "status", description: "🟢 Check live bot and web counters" },
  { command: "server", description: "🖥️ Show full server diagnostics" },
  { command: "health", description: "🩺 Send a health snapshot to admins" },
  { command: "report", description: "📊 Show the current daily report" },
  { command: "daily", description: "🗓️ Send the daily summary now" },
  { command: "broadcast", description: "📢 Send a broadcast message to all users" },
  { command: "users", description: "👥 Show total unique user statistics" },
];

const adminFrenchCommands: BotCommand[] = [
  ...publicFrenchCommands,
  { command: "queuestatus", description: "🗂️ Voir l’état de la file serveur" },
  { command: "status", description: "🟢 Voir les compteurs live bot et web" },
  { command: "server", description: "🖥️ Voir le diagnostic serveur complet" },
  { command: "health", description: "🩺 Envoyer un point santé aux admins" },
  { command: "report", description: "📊 Voir le rapport journalier courant" },
  { command: "daily", description: "🗓️ Envoyer le récap journalier maintenant" },
  { command: "broadcast", description: "📢 Diffuser un message à tous les utilisateurs" },
  { command: "users", description: "👥 Voir les statistiques des utilisateurs uniques" },
];

async function setCommands(
  bot: Telegraf,
  commands: BotCommand[],
  scope: CommandScope,
  languageCode?: string,
) {
  // Removed redundant deleteMyCommands. setMyCommands overwrites them.
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
  const descPrefix = "Dev: https://t.me/akaiokami_az\n\n";
  const privacyLine = `\n\n⚖️ Privacy Policy: ${appConfig.baseUrl}/privacy`;

  logServer("info", "bot.metadata.descriptions.sync.started", {
    botName,
  });

  await safeTelegramCall(bot, "setMyName", { name: botName });
  await safeTelegramCall(bot, "setMyName", {
    language_code: "fr",
    name: botName,
  });

  await safeTelegramCall(bot, "setMyDescription", {
    description: `${descPrefix}Send a media link, choose the format, and receive the prepared file in Telegram or continue in the web app if it's too large.${privacyLine}`,
  });
  await safeTelegramCall(bot, "setMyDescription", {
    language_code: "fr",
    description: `${descPrefix}Envoie un lien média, choisis le format, puis reçois le fichier préparé dans Telegram ou continue dans l'app web si le fichier est trop lourd.${privacyLine}`,
  });

  await safeTelegramCall(bot, "setMyShortDescription", {
    short_description: "🎬 Download video and audio - TikTok, IG, YT & more. Dev: @akaiokami_az",
  });
  await safeTelegramCall(bot, "setMyShortDescription", {
    language_code: "fr",
    short_description: "🎬 Téléchargement vidéo et audio - TikTok, IG, YT & plus. Dev: @akaiokami_az",
  });

  const descriptionDefault = await safeTelegramCall<{ description: string }>(bot, "getMyDescription");
  const descriptionFr = await safeTelegramCall<{ description: string }>(bot, "getMyDescription", {
    language_code: "fr",
  });
  const shortDescriptionDefault = await safeTelegramCall<{ short_description: string }>(bot, "getMyShortDescription");
  const shortDescriptionFr = await safeTelegramCall<{ short_description: string }>(bot, "getMyShortDescription", {
    language_code: "fr",
  });
  const nameDefault = await safeTelegramCall<{ name: string }>(bot, "getMyName");
  const nameFr = await safeTelegramCall<{ name: string }>(bot, "getMyName", {
    language_code: "fr",
  });

  logServer("info", "bot.metadata.descriptions.snapshot", {
    nameDefault: nameDefault?.name || "MISSING",
    nameFr: nameFr?.name || "MISSING",
    descriptionDefault: descriptionDefault?.description || "MISSING",
    descriptionFr: descriptionFr?.description || "MISSING",
    shortDescriptionDefault: shortDescriptionDefault?.short_description || "MISSING",
    shortDescriptionFr: shortDescriptionFr?.short_description || "MISSING",
  });

  // Basic validation to ensure we're not flying blind
  if (!nameDefault?.name || !descriptionDefault?.description) {
    throw new Error("Critical bot metadata verification failed: Default name or description is empty after sync.");
  }

}

export async function applyTelegramMetadata(bot: Telegraf) {
  logServer("info", "bot.metadata.sync.start", {
    appName: appConfig.appName,
    adminCount: appConfig.telegramAdminIds.length,
  });

  try {
    // 1. Set global commands
    logServer("info", "bot.metadata.sync.commands.global");
    await setCommands(bot, publicEnglishCommands, { type: "default" });
    await setCommands(bot, publicFrenchCommands, { type: "default" }, "fr");
    await setCommands(bot, publicEnglishCommands, { type: "all_private_chats" });
    await setCommands(bot, publicFrenchCommands, { type: "all_private_chats" }, "fr");

    // 2. Set admin commands
    for (const adminId of appConfig.telegramAdminIds) {
      logServer("info", "bot.metadata.sync.commands.admin", { adminId });
      await setCommands(bot, adminEnglishCommands, { type: "chat", chat_id: adminId });
      await setCommands(bot, adminFrenchCommands, { type: "chat", chat_id: adminId }, "fr");
    }

    // 3. Sync descriptions (About/Bio)
    logServer("info", "bot.metadata.sync.descriptions");
    await syncDescriptions(bot);

    // 4. Set Menu Button
    logServer("info", "bot.metadata.sync.menu_button");
    await safeTelegramCall(bot, "setChatMenuButton", {
      menu_button: { type: "commands" },
    });

    logServer("info", "bot.metadata.sync.privacy_policy", {
      url: `${appConfig.baseUrl}/privacy`,
    });
    await safeTelegramCall(bot, "setMyPrivacyPolicyUrl", {
      url: `${appConfig.baseUrl}/privacy`,
    });

    logServer("info", "bot.metadata.sync.success", {
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logServer("error", "bot.metadata.sync.fatal", {
      error: String(err),
    });
    throw err;
  }
}
