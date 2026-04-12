import { flushDailySummary, getDailySummary, getServerDiagnostics, appConfig, logServer } from "@pulsorclip/core/server";
import cron from "node-cron";
import { notifyAdmins } from "./notifications";

type BotLike = {
  telegram: {
    getMe: () => Promise<unknown>;
    sendMessage: (chatId: number, text: string) => Promise<unknown>;
  };
};

let lastHealthSignature = "";

function formatBinaryLine(label: string, ok: boolean, version: string | null, error?: string) {
  if (ok) {
    return `${label}: ok${version ? ` (${version})` : ""}`;
  }

  return `${label}: issue detected${error ? ` (${error})` : ""}`;
}

function formatHealth(snapshot: Awaited<ReturnType<typeof getServerDiagnostics>>) {
  const activeJobLine = snapshot.queue.activeJob
    ? `${snapshot.queue.activeJob.id} · ${snapshot.queue.activeJob.mode} · ${snapshot.queue.activeJob.progress}%`
    : "none";

  return [
    "PulsorClip health check",
    "",
    `Checked at: ${snapshot.checkedAt}`,
    `Web: ${snapshot.webHealthOk ? "ok" : "issue detected"}`,
    `Bot mode: ${snapshot.botEnabled ? "enabled" : "disabled"}`,
    `Maintenance: ${snapshot.maintenanceMode ? "on" : "off"}`,
    formatBinaryLine("yt-dlp", snapshot.binaries.ytDlp.ok, snapshot.binaries.ytDlp.version, snapshot.binaries.ytDlp.error),
    formatBinaryLine("ffmpeg", snapshot.binaries.ffmpeg.ok, snapshot.binaries.ffmpeg.version, snapshot.binaries.ffmpeg.error),
    `Downloads dir writable: ${snapshot.downloadsDir.writable ? "yes" : "no"}`,
    `Queue: ${snapshot.queue.queuedCount} queued / ${snapshot.queue.completedJobs} done / ${snapshot.queue.errorJobs} error`,
    `Active job: ${activeJobLine}`,
    `Runtime DB: ${snapshot.runtimeDb.sizeBytes} bytes`,
    `Admins configured: ${snapshot.adminCount}`,
    `RSS memory: ${snapshot.memoryRssMb} MB`,
    `Process uptime: ${snapshot.uptimeSeconds}s`,
  ].join("\n");
}

function formatQueue(snapshot: Awaited<ReturnType<typeof getServerDiagnostics>>) {
  const queued = snapshot.queue.queuedJobIds.length
    ? snapshot.queue.queuedJobIds.map((jobId, index) => `${index + 1}. ${jobId}`).join("\n")
    : "No queued jobs.";

  return [
    "PulsorClip queue snapshot",
    "",
    `Checked at: ${snapshot.checkedAt}`,
    `Active job: ${snapshot.queue.activeJob ? snapshot.queue.activeJob.id : "none"}`,
    `Queued jobs: ${snapshot.queue.queuedCount}`,
    `Completed jobs in memory: ${snapshot.queue.completedJobs}`,
    `Error jobs in memory: ${snapshot.queue.errorJobs}`,
    "",
    queued,
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
  const snapshot = await getServerDiagnostics();
  await notifyAdmins(bot, formatHealth(snapshot));
}

export async function sendDailySnapshot(bot: BotLike) {
  await notifyAdmins(bot, formatDailyReport());
}

export async function getServerHealthText() {
  return formatHealth(await getServerDiagnostics());
}

export async function getQueueSnapshotText() {
  return formatQueue(await getServerDiagnostics());
}



export function startBotMonitoring(bot: BotLike) {
  const runHealthCheck = async () => {
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
      await notifyAdmins(bot, formatHealth(snapshot));
    }
  };

  void runHealthCheck();
  
  // Custom cadence health check (standard is 15 mins)
  const healthCron = `*/${appConfig.healthCheckCadenceMins} * * * *`;
  cron.schedule(healthCron, () => {
    logServer("info", "bot.monitoring.health_check.triggered", { cron: healthCron });
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
      void notifyAdmins(bot, formatDailyReport());
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

  logServer("info", "bot.monitoring.started", {
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
