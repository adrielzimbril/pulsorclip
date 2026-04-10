import { flushDailySummary, getDailySummary, getServerDiagnostics } from "@pulsorclip/core/server";
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

function nextUtcMidnightDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
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
