import { Telegraf } from "telegraf";

const englishCommands = [
  { command: "start", description: "🚀 Open the guided PulsorClip flow" },
  { command: "help", description: "🧭 Show commands and URL examples" },
  { command: "status", description: "🟢 Check bot health and maintenance" },
  { command: "video", description: "🎬 Prepare a video export" },
  { command: "audio", description: "🎧 Prepare an audio export" },
  { command: "mp4", description: "📦 Save video mode, then send a URL" },
  { command: "mp3", description: "🎵 Save audio mode, then send a URL" },
  { command: "formats", description: "🧱 List supported export formats" },
];

const frenchCommands = [
  { command: "start", description: "🚀 Ouvrir le flow guide PulsorClip" },
  { command: "help", description: "🧭 Afficher les commandes et exemples" },
  { command: "status", description: "🟢 Verifier l etat et la maintenance" },
  { command: "video", description: "🎬 Preparer un export video" },
  { command: "audio", description: "🎧 Preparer un export audio" },
  { command: "mp4", description: "📦 Memoriser le mode video puis envoyer une URL" },
  { command: "mp3", description: "🎵 Memoriser le mode audio puis envoyer une URL" },
  { command: "formats", description: "🧱 Lister les formats pris en charge" },
];

export async function applyTelegramMetadata(bot: Telegraf) {
  await bot.telegram.callApi("setMyCommands", { commands: englishCommands });
  await bot.telegram.callApi("setMyCommands", { commands: frenchCommands, language_code: "fr" });
  await bot.telegram.callApi("setMyDescription", {
    description: "Guided media inspection and export bot for PulsorClip.",
  });
  await bot.telegram.callApi("setMyShortDescription", {
    short_description: "Inspect media URLs and export with a guided Telegram flow.",
  });
  await bot.telegram.callApi("setChatMenuButton", {
    menu_button: {
      type: "commands",
    },
  });
}
