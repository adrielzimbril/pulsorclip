import { appConfig, flushDailySummary, getDailySummary } from "@pulsorclip/core/server";
import { notifyAdmins } from "./notifications";

type BotLike = {
  telegram: {
    getMe: () => Promise<unknown>;
    sendMessage: (chatId: number, text: string) => Promise<unknown>;
  };
};

type HealthSnapshot = {
  webOk: boolean;
  botOk: boolean;
  checkedAt: string;
};

let lastHealthSignature = "";

async function checkWebHealth() {
  try {
    const response = await fetch(`${appConfig.baseUrl}/api/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkBotHealth(bot: BotLike) {
  try {
    await bot.telegram.getMe();
    return true;
  } catch {
    return false;
  }
}

function formatHealth(snapshot: HealthSnapshot) {
  return [
    "PulsorClip health check",
    "",
    `Bot: ${snapshot.botOk ? "ok" : "issue detected"}`,
    `Web: ${snapshot.webOk ? "ok" : "issue detected"}`,
    `Checked at: ${snapshot.checkedAt}`,
  ].join("\n");
}

function formatDailyReport() {
  const summary = flushDailySummary();

  return [
    "PulsorClip daily report",
    "",
    `Window: ${summary.date} UTC`,
    `Bot users seen: ${summary.botUsers}`,
    `Bot downloads queued: ${summary.downloadsCreated.bot}`,
    `Bot downloads completed: ${summary.downloadsCompleted.bot}`,
    `Web downloads queued: ${summary.downloadsCreated.web}`,
    `Web downloads completed: ${summary.downloadsCompleted.web}`,
  ].join("\n");
}

export async function sendHealthSnapshot(bot: BotLike) {
  const snapshot = {
    webOk: await checkWebHealth(),
    botOk: await checkBotHealth(bot),
    checkedAt: new Date().toISOString(),
  };

  await notifyAdmins(bot, formatHealth(snapshot));
}

export async function sendDailySnapshot(bot: BotLike) {
  await notifyAdmins(bot, formatDailyReport());
}

function nextUtcMidnightDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function startBotMonitoring(bot: BotLike) {
  const runHealthCheck = async () => {
    const snapshot = {
      webOk: await checkWebHealth(),
      botOk: await checkBotHealth(bot),
      checkedAt: new Date().toISOString(),
    };
    const signature = `${snapshot.botOk}-${snapshot.webOk}`;

    if (signature !== lastHealthSignature) {
      lastHealthSignature = signature;
      await notifyAdmins(bot, formatHealth(snapshot));
    }
  };

  void runHealthCheck();
  setInterval(() => {
    void runHealthCheck();
  }, 15 * 60_000);

  const scheduleDaily = () => {
    setTimeout(() => {
      void notifyAdmins(bot, formatDailyReport());
      scheduleDaily();
    }, nextUtcMidnightDelay());
  };

  scheduleDaily();
}

export function getCurrentDailySummaryText() {
  const summary = getDailySummary();

  return [
    "PulsorClip live report",
    "",
    `Window: ${summary.date} UTC`,
    `Bot users seen: ${summary.botUsers}`,
    `Bot downloads queued: ${summary.downloadsCreated.bot}`,
    `Bot downloads completed: ${summary.downloadsCompleted.bot}`,
    `Web downloads queued: ${summary.downloadsCreated.web}`,
    `Web downloads completed: ${summary.downloadsCompleted.web}`,
  ].join("\n");
}
