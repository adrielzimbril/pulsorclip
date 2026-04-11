import { Telegraf } from "telegraf";
import { appConfig, logServer, ensureAppDirs } from "@pulsorclip/core/server";
import { t } from "@pulsorclip/core/i18n";
import { registerBotHandlers } from "./handlers";
import { applyTelegramMetadata } from "./metadata";
import { sendHealthSnapshot, startBotMonitoring } from "./monitoring";
import { notifyAdmins, validateAdminRecipients } from "./notifications";

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

async function runBootstrapStep<T>(
  event: string,
  startedMessage: string,
  completedMessage: string,
  action: () => Promise<T>,
) {
  logServer("info", `${event}.started`, {
    message: startedMessage,
  });

  try {
    const result = await action();
    logServer("info", `${event}.completed`, {
      message: completedMessage,
    });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logServer("error", `${event}.failed`, {
      message: `❌ ${completedMessage.replace(/^✅\s*/, "")} failed`,
      reason,
    });
    throw error;
  }
}

async function bootstrap() {
  logServer("info", "bot.bootstrap.started", {
    message: "🚀 Starting Telegram bot bootstrap",
    adminCount: appConfig.telegramAdminIds.length,
    maintenanceMode: appConfig.telegramMaintenanceMode,
    botEnabled: appConfig.telegramBotEnabled,
    configuredUsername: appConfig.telegramBotUsername,
  });
  
  ensureAppDirs();

  try {
    await runBootstrapStep(
      "bot.bootstrap.telegram.cleanup",
      "🧹 Removing previous Telegram webhook",
      "✅ Telegram webhook cleanup completed",
      async () => {
        await bot.telegram.deleteWebhook({ drop_pending_updates: false });
      },
    );

    await runBootstrapStep(
      "bot.bootstrap.launch",
      "🚀 Launching Telegram polling",
      "✅ Telegram polling launched",
      async () => {
        await bot.launch();
      },
    );

    await runBootstrapStep(
      "bot.bootstrap.metadata",
      "📝 Applying Telegram metadata",
      "✅ Telegram metadata applied",
      async () => {
        await applyTelegramMetadata(bot);
      },
    );

    const me = await bot.telegram.getMe();
    logServer("info", "bot.bootstrap.running", {
      message: `🤖 Bot is running as @${me.username || "unknown"}`,
      botId: me.id,
      actualUsername: me.username,
      configuredUsername: appConfig.telegramBotUsername,
      canJoinGroups: me.can_join_groups,
      canReadAllGroupMessages: me.can_read_all_group_messages,
      supportsInlineQueries: me.supports_inline_queries,
    });

    const adminValidation = await validateAdminRecipients(bot);
    const reachableAdmins = adminValidation.filter((item) => item.ok).map((item) => item.adminId);
    const unreachableAdmins = adminValidation.filter((item) => !item.ok);
    logServer("info", "bot.bootstrap.admins.validated", {
      message: `👥 Admin reachability checked: ${reachableAdmins.length} reachable, ${unreachableAdmins.length} unreachable`,
      reachableAdmins,
      unreachableAdmins,
    });

    const adminMessage = appConfig.telegramMaintenanceMode
      ? t("en", "botStartupAdminMaintenance")
      : t("en", "botStartupAdmin");

    const startupResult = await notifyAdmins(bot, `${adminMessage}\n${appConfig.baseUrl}`);
    logServer("info", "bot.bootstrap.admin_notify.completed", {
      message: `📣 Startup notification sent to ${startupResult.delivered} admins`,
      delivered: startupResult.delivered,
      failed: startupResult.failed,
    });

    await sendHealthSnapshot(bot);
    startBotMonitoring(bot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("409") || message.includes("terminated by other getUpdates request")) {
      logServer("error", "bot.bootstrap.conflict", {
        message:
          "❌ Another polling instance is already using this bot token. Keep only one polling bot online, or disable the local bot with TELEGRAM_BOT_ENABLED=false.",
        reason: message,
      });
      return;
    }

    logServer("error", "bot.bootstrap.failed", {
      message:
        "❌ Telegram bot bootstrap failed. Check the reason field and the preceding *.failed event.",
      reason: message,
    });
    throw error;
  }
}

void bootstrap();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
