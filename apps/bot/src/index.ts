import { Telegraf } from "telegraf";
import { appConfig, logServer, ensureAppDirs, resolveRealBinaryPath } from "@pulsorclip/core/server";
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

const bot = new Telegraf(botToken, {
  handlerTimeout: 900000, // 15 minutes to allow for large file uploads on slow connections
});

logServer("info", "bot.init.admins", {
  adminIds: appConfig.telegramAdminIds,
  count: appConfig.telegramAdminIds.length,
});

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
    ytDlpBin: appConfig.ytDlpBin,
    ytDlpReal: resolveRealBinaryPath(appConfig.ytDlpBin),
    ffmpegBin: appConfig.ffmpegBin,
    ffmpegReal: resolveRealBinaryPath(appConfig.ffmpegBin),
  });
  
  ensureAppDirs();

  try {
    const me = await bot.telegram.getMe();
    logServer("info", "bot.bootstrap.identity", {
      message: `🤖 Bot identity verified: @${me.username || "unknown"}`,
      botId: me.id,
      canJoinGroups: me.can_join_groups,
      supportsInlineQueries: me.supports_inline_queries,
    });

    await runBootstrapStep(
      "bot.bootstrap.telegram.cleanup",
      "🧹 Removing previous Telegram webhook",
      "✅ Telegram webhook cleanup completed",
      async () => {
        await bot.telegram.deleteWebhook({ drop_pending_updates: false });
      },
    );

    await runBootstrapStep(
      "bot.bootstrap.metadata",
      "📝 Applying Telegram metadata (commands, name, description)",
      "✅ Telegram metadata applied",
      async () => {
        await applyTelegramMetadata(bot);
      },
    );

    await runBootstrapStep(
      "bot.bootstrap.launch",
      "🚀 Launching Telegram polling loop",
      "✅ Telegram polling launched",
      async () => {
        await bot.launch();
      },
    );

    if (appConfig.telegramAdminIds.length === 0) {
      logServer("warn", "bot.bootstrap.admins.none", {
        message: "⚠️ NO TELEGRAM_ADMIN_IDS configured. Admin notifications (start, daily, health) will be SKIPPED.",
        hint: "Set TELEGRAM_ADMIN_IDS to a comma-separated list of Telegram user IDs in your environment.",
      });
    }

    logServer("info", "bot.bootstrap.admins.validating", {
      message: "🔎 Validating admin reachability...",
      adminIds: appConfig.telegramAdminIds,
    });

    const adminValidation = await validateAdminRecipients(bot);
    const reachableAdmins = adminValidation.filter((item) => item.ok).map((item) => item.adminId);
    const unreachableAdmins = adminValidation.filter((item) => !item.ok);
    
    if (appConfig.telegramAdminIds.length > 0 && reachableAdmins.length === 0) {
      logServer("error", "bot.bootstrap.admins.unreachable", {
        message: "❌ ALL configured TELEGRAM_ADMIN_IDS are unreachable! You will NOT receive notifications.",
        hint: `Ensure you have started a private conversation with the bot (@${(await bot.telegram.getMe()).username}) and that your IDs are correct.`,
        unreachable: unreachableAdmins,
      });
    } else {
      logServer("info", "bot.bootstrap.admins.validated", {
        message: `👥 Admin reachability checked: ${reachableAdmins.length} reachable, ${unreachableAdmins.length} unreachable`,
        reachableAdmins,
        unreachableAdmins,
      });
    }

    const adminLocale = appConfig.defaultLocale || "en";
    const adminMessage = appConfig.telegramMaintenanceMode
      ? t(adminLocale, "botStartupAdminMaintenance")
      : t(adminLocale, "botStartupAdmin");

    logServer("info", "bot.bootstrap.admin_notify.started", {
      message: "📣 Sending startup notification to reachable admins...",
      adminLocale,
      messagePreview: adminMessage.substring(0, 50) + "...",
    });

    const startupResult = await notifyAdmins(bot, `${adminMessage}\n${appConfig.baseUrl}`);
    
    if (reachableAdmins.length > 0 && startupResult.delivered === 0) {
      logServer("error", "bot.bootstrap.admin_notify.failed_all", {
        message: "❌ Startup notification failed to reach ANY admins, even though they were marked as reachable.",
        attempted: reachableAdmins.length,
        failed: startupResult.failed,
      });
    } else {
      logServer("info", "bot.bootstrap.admin_notify.completed", {
        message: `📣 Startup notification sent to ${startupResult.delivered} admins`,
        delivered: startupResult.delivered,
        failed: startupResult.failed,
      });
    }


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
