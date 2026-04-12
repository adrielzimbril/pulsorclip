import { flushDailySummary, getDailySummary, getServerDiagnostics, appConfig, logServer, getMetadata, setMetadata } from "@pulsorclip/core/server";
import cron from "node-cron";
import { notifyAdmins } from "./notifications";

type BotLike = {
  telegram: {
    getMe: () => Promise<unknown>;
    sendMessage: (chatId: number, text: string) => Promise<unknown>;
  };
};

let lastHealthSignature = "";
let lastHealthCheckAt: string | null = null;
let lastDailyReportAt: string | null = null;

function formatBinaryLine(label: string, ok: boolean, version: string | null, error?: string) {
  if (ok) {
    return `${label}: ok${version ? ` (${version})` : ""}`;
  }

  return `${label}: issue detected${error ? ` (${error})` : ""}`;
}

function formatAdminHealth(snapshot: Awaited<ReturnType<typeof getServerDiagnostics>>) {
  const activeJobLine = snapshot.queue.activeJob
    ? `<b>${snapshot.queue.activeJob.id}</b> · ${snapshot.queue.activeJob.mode} · <code>${snapshot.queue.activeJob.progress}%</code>`
    : "<i>None</i>";

  const rows = [
    `<b>🚀 ${appConfig.appName} Operational Status</b>`,
    `<i>Checked at: ${snapshot.checkedAt} UTC</i>`,
    "",
    `🌐 <b>Web Health:</b> ${snapshot.webHealthOk ? "🟢 OK" : "🔴 ISSUE"}`,
    `🤖 <b>Bot Status:</b> ${snapshot.botEnabled ? "✅ Enabled" : "❌ Disabled"}`,
    `🛠️ <b>Maintenance:</b> ${snapshot.maintenanceMode ? "🟠 ON" : "⚪ OFF"}`,
    "",
    `📦 <b>Queue Statistics</b>`,
    `• Waiting: <code>${snapshot.queue.queuedCount}</code>`,
    `• Active: ${activeJobLine}`,
    `• Done / Fail: <code>${snapshot.queue.completedJobs} / ${snapshot.queue.errorJobs}</code>`,
    "",
    `⚙️ <b>System Diagnostics</b>`,
    `• ${formatBinaryLine("yt-dlp", snapshot.binaries.ytDlp.ok, snapshot.binaries.ytDlp.version)}`,
    `• ${formatBinaryLine("ffmpeg", snapshot.binaries.ffmpeg.ok, snapshot.binaries.ffmpeg.version)}`,
    `• Write Access: ${snapshot.downloadsDir.writable ? "✅ Yes" : "❌ No"}`,
    `• Memory: <code>${snapshot.memoryRssMb} MB</code>`,
    `• Uptime: <code>${Math.floor(snapshot.uptimeSeconds / 60)} mins</code>`,
    `• DB Size: <code>${snapshot.runtimeDb.sizeBytes} bytes</code>`,
    "",
    `📅 <b>Cron Schedule</b>`,
    `• Health: ${lastHealthCheckAt ? `✅ ${lastHealthCheckAt}` : "⏳ Pending"}`,
    `• Daily: ${lastDailyReportAt ? `✅ ${lastDailyReportAt}` : "⏳ Pending"}`,
    "",
    `📊 <b>Daily Aggregate</b>`,
    `• Users: <code>${getDailySummary().botUsers}</code>`,
    `• Bot Jobs: <code>${getDailySummary().downloadsCompleted.bot}</code>`,
    `• Web Jobs: <code>${getDailySummary().downloadsCompleted.web}</code>`,
    "",
    `👥 <b>Admin Count:</b> ${snapshot.adminCount}`,
  ];

  return rows.join("\n");
}

function formatPublicHealth(snapshot: Awaited<ReturnType<typeof getServerDiagnostics>>, isAdmin: boolean = false) {
  const statusIcon = snapshot.maintenanceMode ? "🟠" : (snapshot.botEnabled ? "🟢" : "🔴");
  const statusText = snapshot.maintenanceMode ? "Maintenance" : (snapshot.botEnabled ? "Online" : "Offline");
  const totalLoad = snapshot.queue.queuedCount + (snapshot.queue.activeJob ? 1 : 0);
  
  const rows = [
    `<b>✨ PulsorClip Network Status</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `📡 <b>Core System:</b> ${statusIcon} ${statusText}`,
    `⚡ <b>Current Load:</b> ${totalLoad} active session${totalLoad !== 1 ? 's' : ''}`,
  ];

  if (isAdmin) {
    const summary = getDailySummary();
    rows.push(
      `━━━━━━━━━━━━━━━━━━`,
      `📊 <b>Admin Dashboard</b>`,
      `• Active today: <code>${summary.botUsers}</code> users`,
      `• Total jobs today: <code>${summary.downloadsCompleted.bot + summary.downloadsCompleted.web}</code>`
    );
  }

  rows.push(
    `━━━━━━━━━━━━━━━━━━`,
    "<i>Everything is running smoothly. Ready for your next high-speed media conversion!</i>"
  );

  return rows.join("\n");
}

function formatQueue(snapshot: Awaited<ReturnType<typeof getServerDiagnostics>>) {
  const queued = snapshot.queue.queuedJobIds.length
    ? snapshot.queue.queuedJobIds.map((jobId, index) => `<code>${index + 1}. ${jobId}</code>`).join("\n")
    : "<i>No queued jobs.</i>";

  return [
    "<b>🗂️ PulsorClip Queue Snapshot</b>",
    `<i>Checked at: ${snapshot.checkedAt}</i>`,
    "",
    `▶️ <b>Active job:</b> ${snapshot.queue.activeJob ? `<code>${snapshot.queue.activeJob.id}</code>` : "none"}`,
    `⏳ <b>Queued:</b> <code>${snapshot.queue.queuedCount}</code>`,
    `✅ <b>Completed:</b> <code>${snapshot.queue.completedJobs}</code>`,
    `❌ <b>Errors:</b> <code>${snapshot.queue.errorJobs}</code>`,
    "",
    `<b>Listing:</b>`,
    queued,
  ].join("\n");
}

function formatDailyReport() {
  const summary = flushDailySummary();

  return [
    "<b>📊 PulsorClip Daily Aggregate</b>",
    `<i>Window: ${summary.date} UTC</i>`,
    "",
    `👥 <b>Users seen:</b> <code>${summary.botUsers}</code>`,
    "",
    `🤖 <b>Bot Downloads</b>`,
    `• Queued: <code>${summary.downloadsCreated.bot}</code>`,
    `• Success: <code>${summary.downloadsCompleted.bot}</code>`,
    "",
    `🌐 <b>Web Downloads</b>`,
    `• Queued: <code>${summary.downloadsCreated.web}</code>`,
    `• Success: <code>${summary.downloadsCompleted.web}</code>`,
  ].join("\n");
}

export async function sendHealthSnapshot(bot: BotLike) {
  const snapshot = await getServerDiagnostics();
  await notifyAdmins(bot, formatAdminHealth(snapshot));
}

export async function sendDailySnapshot(bot: BotLike) {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  lastDailyReportAt = now.toISOString().replace("T", " ").split(".")[0] + " UTC";
  
  await notifyAdmins(bot, formatDailyReport());
  setMetadata("last_daily_report_date", dateKey);
}

async function catchUpDailyReport(bot: BotLike) {
  if (!appConfig.dailyReportEnabled) return;

  const lastReportDate = getMetadata("last_daily_report_date");
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10);
  const currentHour = now.getUTCHours();

  logServer("info", "bot.monitoring.catchup.check", { 
    lastReportDate, 
    todayDate, 
    currentHour, 
    targetHour: appConfig.dailyReportHour 
  });

  // If we haven't reported today and it's past the reporting hour, do it now.
  if (lastReportDate !== todayDate && currentHour >= appConfig.dailyReportHour) {
    logServer("info", "bot.monitoring.catchup.triggering", { reason: "Missed scheduled window" });
    await sendDailySnapshot(bot);
  }
}

export async function getServerHealthText(isAdmin: boolean = false) {
  const snapshot = await getServerDiagnostics();
  return isAdmin ? formatAdminHealth(snapshot) : formatPublicHealth(snapshot, isAdmin);
}

export async function getQueueSnapshotText() {
  return formatQueue(await getServerDiagnostics());
}

export function startBotMonitoring(bot: BotLike) {
  logServer("info", "bot.monitoring.init", {
    message: "Initializing internal bot monitoring (node-cron)",
  });

  // Catch-up on startup
  void catchUpDailyReport(bot);

  const runHealthCheck = async () => {
    lastHealthCheckAt = new Date().toISOString().replace("T", " ").split(".")[0] + " UTC";
    const snapshot = await getServerDiagnostics();
    const signature = [
      snapshot.webHealthOk,
      snapshot.botEnabled,
      snapshot.maintenanceMode,
      snapshot.binaries.ytDlp.ok,
      snapshot.binaries.ffmpeg.ok,
      snapshot.downloadsDir.writable,
      snapshot.queue.errorJobs,
    ].join("-");

    if (signature !== lastHealthSignature) {
      lastHealthSignature = signature;
      await notifyAdmins(bot, formatAdminHealth(snapshot));
    }
  };

  void runHealthCheck();
  
  // Custom cadence health check
  const healthCron = `*/${appConfig.healthCheckCadenceMins} * * * *`;
  cron.schedule(healthCron, () => {
    logServer("info", "bot.monitoring.health_check.triggered", { 
      cron: healthCron,
      cadence: `${appConfig.healthCheckCadenceMins} mins` 
    });
    void runHealthCheck();
  });

  // Daily report at configurable hour (UTC)
  if (appConfig.dailyReportEnabled) {
    const dailyCron = `0 ${appConfig.dailyReportHour} * * *`;
    cron.schedule(dailyCron, () => {
      logServer("info", "bot.monitoring.daily_report.triggered", { 
        cron: dailyCron,
        hour: appConfig.dailyReportHour,
        timezone: "UTC"
      });
      void sendDailySnapshot(bot);
    }, {
      timezone: "UTC"
    });

    logServer("info", "bot.monitoring.daily_report.scheduled", {
      cron: dailyCron,
      hour: appConfig.dailyReportHour,
      timezone: "UTC"
    });
  } else {
    logServer("info", "bot.monitoring.daily_report.disabled", {
      message: "Daily report is disabled via PULSORCLIP_DAILY_REPORT_ENABLED=false"
    });
  }

  logServer("info", "bot.monitoring.ready", {
    healthCadenceMins: appConfig.healthCheckCadenceMins,
    dailyReportHourUtc: appConfig.dailyReportHour,
  });
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
