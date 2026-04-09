import { Telegraf } from "telegraf";
import { appConfig } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { registerBotHandlers } from "./handlers";
import { applyTelegramMetadata } from "./metadata";
import { notifyAdmins } from "./notifications";

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!appConfig.telegramBotEnabled) {
  console.log("PulsorClip Telegram bot disabled by TELEGRAM_BOT_ENABLED=false.");
  process.exit(0);
}

if (!botToken) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const bot = new Telegraf(botToken);

registerBotHandlers(bot);

async function bootstrap() {
  await applyTelegramMetadata(bot);
  try {
    await bot.launch();
    console.log(`PulsorClip Telegram bot running as @${appConfig.telegramBotUsername}.`);

    const adminMessage = appConfig.telegramMaintenanceMode
      ? t("en", "botStartupAdminMaintenance")
      : t("en", "botStartupAdmin");

    await notifyAdmins(bot, `${adminMessage}\n${appConfig.baseUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("409") || message.includes("terminated by other getUpdates request")) {
      console.error(
        "PulsorClip Telegram bot did not start because another polling instance is already using this token. Keep only one polling bot online, or disable the local bot with TELEGRAM_BOT_ENABLED=false.",
      );
      return;
    }

    throw error;
  }
}

void bootstrap();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
