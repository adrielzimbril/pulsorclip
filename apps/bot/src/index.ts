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

async function bootstrap() {
  logServer("info", "bot.bootstrap.started", {
    adminCount: appConfig.telegramAdminIds.length,
    maintenanceMode: appConfig.telegramMaintenanceMode,
    botEnabled: appConfig.telegramBotEnabled,
    configuredUsername: appConfig.telegramBotUsername,
  });
  
  ensureAppDirs();

  try {
    logServer("info", "bot.bootstrap.telegram.cleanup.started", {});
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
    logServer("info", "bot.bootstrap.telegram.cleanup.completed", {});

    logServer("info", "bot.bootstrap.launch.started", {});
    await bot.launch();
    logServer("info", "bot.bootstrap.launch.completed", {});

    logServer("info", "bot.bootstrap.metadata.started", {});
    await applyTelegramMetadata(bot);
    logServer("info", "bot.bootstrap.metadata.completed", {});

    const me = await bot.telegram.getMe();
    logServer("info", "bot.bootstrap.running", {
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
      reachableAdmins,
      unreachableAdmins,
    });

    const adminMessage = appConfig.telegramMaintenanceMode
      ? t("en", "botStartupAdminMaintenance")
      : t("en", "botStartupAdmin");

    const startupResult = await notifyAdmins(bot, `${adminMessage}\n${appConfig.baseUrl}`);
    logServer("info", "bot.bootstrap.admin_notify.completed", {
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
          "Another polling instance is already using this token. Keep only one polling bot online, or disable the local bot with TELEGRAM_BOT_ENABLED=false.",
      });
      return;
    }

    logServer("error", "bot.bootstrap.failed", {
      message,
    });
    throw error;
  }
}

void bootstrap();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
