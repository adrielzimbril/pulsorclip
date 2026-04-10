import { Telegraf } from "telegraf";
import { appConfig } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { registerBotHandlers } from "./handlers";
import { applyTelegramMetadata } from "./metadata";
import { sendHealthSnapshot, startBotMonitoring } from "./monitoring";
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
  console.log(`[pulsorclip-bot] booting with ${appConfig.telegramAdminIds.length} configured admin id(s).`);

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
    await bot.launch();
    await applyTelegramMetadata(bot);
    console.log(`PulsorClip Telegram bot running as @${appConfig.telegramBotUsername}.`);

    const adminMessage = appConfig.telegramMaintenanceMode
      ? t("en", "botStartupAdminMaintenance")
      : t("en", "botStartupAdmin");

    const startupResult = await notifyAdmins(bot, `${adminMessage}\n${appConfig.baseUrl}`);
    console.log(
      `[pulsorclip-bot] startup admin notifications: delivered=${startupResult.delivered}, failed=${startupResult.failed}`,
    );

    await sendHealthSnapshot(bot);
    startBotMonitoring(bot);
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
