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
  { command: "language", description: "🌐 Choose your preferred language" },
  { command: "help", description: "🧭 Show commands and usage examples" },
  { command: "video", description: "🎬 Download video from a URL" },
  { command: "audio", description: "🎧 Download audio from a URL" },
  { command: "track", description: "🔍 Track a specific job status" },
  { command: "support", description: "🤝 Get help or contact the operator" },
];

const publicEnglishCommands: BotCommand[] = [
  ...publicEnglishBaseCommands,
  { command: "queue", description: "📦 View your active jobs and queue" },
];

const publicFrenchBaseCommands: BotCommand[] = [
  { command: "start", description: "🚀 Démarrer le flow guidé PulsorClip" },
  { command: "language", description: "🌐 Choisir la langue du bot" },
  { command: "help", description: "🧭 Afficher les commandes et exemples" },
  { command: "video", description: "🎬 Télécharger une vidéo depuis une URL" },
  { command: "audio", description: "🎧 Télécharger un audio depuis une URL" },
  { command: "track", description: "🔍 Suivre l'état d'une tâche spécifique" },
  { command: "support", description: "🤝 Obtenir de l'aide ou contacter l'opérateur" },
];

const publicFrenchCommands: BotCommand[] = [
  ...publicFrenchBaseCommands,
  { command: "queue", description: "📦 Voir tes tâches et ta file d'attente" },
];

const adminEnglishCommands: BotCommand[] = [
  ...publicEnglishCommands,
  { command: "queuestatus", description: "🗂️ Server Queue Snapshot" },
  { command: "status", description: "🟢 Bot & Web Live Counters" },
  { command: "server", description: "🖥️ Detailed Server Diagnostics" },
  { command: "health", description: "🩺 Send Health Snapshot to Admins" },
  { command: "report", description: "📊 Current Daily Statistics" },
  { command: "broadcast", description: "📢 Message All Bot Users" },
  { command: "users", description: "👥 User Base Statistics" },
];

const adminFrenchCommands: BotCommand[] = [
  ...publicFrenchCommands,
  { command: "queuestatus", description: "🗂️ État de la file serveur" },
  { command: "status", description: "🟢 Compteurs Live Bot & Web" },
  { command: "server", description: "🖥️ Diagnostic Serveur Détaillé" },
  { command: "health", description: "🩺 Point Santé aux Admins" },
  { command: "report", description: "📊 Statistiques Journalières" },
  { command: "broadcast", description: "📢 Message à tous les utilisateurs" },
  { command: "users", description: "👥 Statistiques des Utilisateurs" },
];

async function setCommands(
  bot: Telegraf,
  commands: BotCommand[],
  scope: CommandScope,
  languageCode?: string,
) {
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
  const botName = "PulsorClip | Media Downloader";
  const url = appConfig.baseUrl;
  
  const descPrefixEn = "🚀 PulsorClip: Professional Media Extraction Tool\n\n";
  const descPrefixFr = "🚀 PulsorClip : Outil Professionnel d'Extraction Média\n\n";
  
  const bodyEn = "Send any media link (TikTok, Instagram, YouTube, etc.), choose your format, and receive the file directly in Telegram. Fast, reliable, and privacy-focused.";
  const bodyFr = "Envoyez n'importe quel lien média (TikTok, Instagram, YouTube, etc.), choisissez votre format et recevez le fichier directement dans Telegram. Rapide, fiable et respectueux de la privacy policy.";

  const linksEn = `\n\n⚖️ Privacy Policy: ${url}/privacy\n🚩 DMCA: ${url}/dmca\n👨‍💻 Dev: @${appConfig.telegramAdminHandle}`;
  const linksFr = `\n\n⚖️ Privacy Policy : ${url}/privacy\n🚩 DMCA : ${url}/dmca\n👨‍💻 Développeur : @${appConfig.telegramAdminHandle}`;

  logServer("info", "bot.metadata.descriptions.sync.started", {
    botName,
  });

  // Set Names
  await safeTelegramCall(bot, "setMyName", { name: botName });
  await safeTelegramCall(bot, "setMyName", { language_code: "fr", name: botName });

  // Set Descriptions (About section)
  await safeTelegramCall(bot, "setMyDescription", {
    description: `${descPrefixEn}${bodyEn}${linksEn}`,
  });
  await safeTelegramCall(bot, "setMyDescription", {
    language_code: "fr",
    description: `${descPrefixFr}${bodyFr}${linksFr}`,
  });

  // Set Short Descriptions (What can this bot do?)
  await safeTelegramCall(bot, "setMyShortDescription", {
    short_description: "🎬 Download high-quality video and audio from TikTok, IG, YT & more. Powered by PulsorClip.",
  });
  await safeTelegramCall(bot, "setMyShortDescription", {
    language_code: "fr",
    short_description: "🎬 Téléchargez vidéos et audios HD depuis TikTok, IG, YT & plus. Propulsé par PulsorClip.",
  });

  const descriptionDefault = await safeTelegramCall<{ description: string }>(bot, "getMyDescription");
  const descriptionFr = await safeTelegramCall<{ description: string }>(bot, "getMyDescription", { language_code: "fr" });
  
  logServer("info", "bot.metadata.descriptions.snapshot", {
    descriptionDefault: descriptionDefault?.description || "MISSING",
    descriptionFr: descriptionFr?.description || "MISSING",
  });

  if (!descriptionDefault?.description) {
    throw new Error("Critical bot metadata verification failed: Default description is empty after sync.");
  }
}

export async function applyTelegramMetadata(bot: Telegraf) {
  logServer("info", "bot.metadata.sync.start", {
    appName: appConfig.appName,
    adminCount: appConfig.telegramAdminIds.length,
  });

  try {
    // 1. Set global commands
    await setCommands(bot, publicEnglishCommands, { type: "default" });
    await setCommands(bot, publicFrenchCommands, { type: "default" }, "fr");
    await setCommands(bot, publicEnglishCommands, { type: "all_private_chats" });
    await setCommands(bot, publicFrenchCommands, { type: "all_private_chats" }, "fr");

    // 2. Set admin commands
    for (const adminId of appConfig.telegramAdminIds) {
      await setCommands(bot, adminEnglishCommands, { type: "chat", chat_id: adminId });
      await setCommands(bot, adminFrenchCommands, { type: "chat", chat_id: adminId }, "fr");
    }

    // 3. Sync descriptions (About/Bio)
    await syncDescriptions(bot);

    // 4. Set Menu Button
    await safeTelegramCall(bot, "setChatMenuButton", {
      menu_button: { type: "commands" },
    });

    // 5. Privacy Policy Link
    await safeTelegramCall(bot, "setMyPrivacyPolicyUrl", {
      url: `${appConfig.baseUrl}/privacy`,
    });

    logServer("info", "bot.metadata.sync.success");
  } catch (err) {
    logServer("error", "bot.metadata.sync.fatal", {
      error: String(err),
    });
    throw err;
  }
}
