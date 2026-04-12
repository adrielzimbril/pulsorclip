import { Telegraf } from "telegraf";
import { appConfig, logServer } from "@pulsorclip/core/server";
import { sendDailySnapshot } from "../monitoring";

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

async function trigger() {
  logServer("info", "cron.external.report.triggered", {
    message: "🚀 External cron trigger for daily report started"
  });

  try {
    const bot = new Telegraf(botToken);
    await sendDailySnapshot(bot);
    
    logServer("info", "cron.external.report.completed", {
      message: "✅ External daily report delivered successfully"
    });
    
    // Give some time for logs to flush if needed
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logServer("error", "cron.external.report.failed", {
      message: "❌ External daily report failed",
      reason: message
    });
    process.exit(1);
  }
}

void trigger();
