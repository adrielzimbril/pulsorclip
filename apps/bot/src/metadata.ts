import { Telegraf } from "telegraf";
import { appConfig } from "@pulsorclip/core/server";

type MetadataMethod = "setMyCommands" | "setMyDescription" | "setMyShortDescription" | "setChatMenuButton";

async function safeTelegramCall(bot: Telegraf, method: MetadataMethod, payload: Record<string, unknown>) {
  try {
    await bot.telegram.callApi(method, payload as never);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(`[pulsorclip-bot] telegram metadata call failed for ${method}: ${details}`);
  }
}

const publicEnglishCommands = [
  { command: "start", description: "?? Open the guided PulsorClip flow" },
  { command: "help", description: "?? Show commands and URL examples" },
  { command: "video", description: "?? Prepare a video export" },
  { command: "audio", description: "?? Prepare an audio export" },
  { command: "mp4", description: "?? Save video mode, then send a URL" },
  { command: "mp3", description: "?? Save audio mode, then send a URL" },
  { command: "formats", description: "?? List supported export formats" },
];

const publicFrenchCommands = [
  { command: "start", description: "?? Ouvrir le flow guide PulsorClip" },
  { command: "help", description: "?? Afficher les commandes et exemples" },
  { command: "video", description: "?? Preparer un export video" },
  { command: "audio", description: "?? Preparer un export audio" },
  { command: "mp4", description: "?? Memoriser le mode video puis envoyer une URL" },
  { command: "mp3", description: "?? Memoriser le mode audio puis envoyer une URL" },
  { command: "formats", description: "?? Lister les formats pris en charge" },
];

const adminEnglishCommands = [
  ...publicEnglishCommands,
  { command: "status", description: "?? Check live bot and web counters" },
  { command: "health", description: "?? Send a health snapshot to admins" },
  { command: "report", description: "?? Show the current daily report" },
  { command: "daily", description: "??? Send the daily summary now" },
];

const adminFrenchCommands = [
  ...publicFrenchCommands,
  { command: "status", description: "?? Voir les compteurs live bot et web" },
  { command: "health", description: "?? Envoyer un point sante aux admins" },
  { command: "report", description: "?? Voir le rapport journalier courant" },
  { command: "daily", description: "??? Envoyer le recap journalier maintenant" },
];

export async function applyTelegramMetadata(bot: Telegraf) {
  await safeTelegramCall(bot, "setMyCommands", { commands: publicEnglishCommands });
  await safeTelegramCall(bot, "setMyCommands", { commands: publicFrenchCommands, language_code: "fr" });

  for (const adminId of appConfig.telegramAdminIds) {
    await safeTelegramCall(bot, "setMyCommands", {
      commands: adminEnglishCommands,
      scope: {
        type: "chat",
        chat_id: adminId,
      },
    });
    await safeTelegramCall(bot, "setMyCommands", {
      commands: adminFrenchCommands,
      language_code: "fr",
      scope: {
        type: "chat",
        chat_id: adminId,
      },
    });
  }

  await safeTelegramCall(bot, "setMyDescription", {
    description: "Guided media inspection and export bot for PulsorClip.",
  });
  await safeTelegramCall(bot, "setMyShortDescription", {
    short_description: "Inspect media URLs and export with a guided Telegram flow.",
  });
  await safeTelegramCall(bot, "setChatMenuButton", {
    menu_button: {
      type: "commands",
    },
  });
}
