import { statSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getQueueSnapshot } from "./downloader";
import { appConfig } from "./config";
import { runCommand } from "./process";
import { getRuntimeDbPath } from "./runtime-db";
import os from "os";
import fs from "fs";
import net from "net";

type BinaryStatus = {
  ok: boolean;
  version: string | null;
  error?: string;
};

type ServerDiagnostics = {
  checkedAt: string;
  uptimeSeconds: number;
  memoryRssMb: number;
  maintenanceMode: boolean;
  botEnabled: boolean;
  adminCount: number;
  webHealthOk: boolean;
  runtimeDb: {
    path: string;
    sizeBytes: number;
  };
  downloadsDir: {
    path: string;
    writable: boolean;
  };
  binaries: {
    ytDlp: BinaryStatus;
    ffmpeg: BinaryStatus;
  };
  queue: ReturnType<typeof getQueueSnapshot>;
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  diskUsage: {
    totalGB: string;
    usedGB: string;
    freeGB: string;
  } | null;

  cpuModel: string | undefined;
  cpuCores: number;

  loadAvg: number[];

  activeConnectionsApprox: number | null;

  totalMemoryMB: number;
  freeMemoryMB: number;
  usedMemoryMB: number;

  uptimeSec: number;

  nodeVersion: string;

  processMemoryMB: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
};

async function checkBinary(command: string, args: string[]): Promise<BinaryStatus> {
  try {
    const result = await runCommand(command, args, 10_000);

    if (result.exitCode !== 0) {
      return {
        ok: false,
        version: null,
        error: result.stderr.trim() || result.stdout.trim() || "Command failed",
      };
    }

    const line = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).find(Boolean)?.trim() || null;
    return { ok: true, version: line };
  } catch (error) {
    return {
      ok: false,
      version: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkWebHealth() {
  try {
    const response = await fetch(`${appConfig.baseUrl}/api/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function checkDownloadsDirWritable() {
  const probePath = join(appConfig.downloadsDir, ".runtime", ".write-check");

  try {
    writeFileSync(probePath, String(Date.now()), "utf8");
    rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function getServerDiagnostics(): Promise<ServerDiagnostics> {
  const runtimeDbPath = getRuntimeDbPath();
  const runtimeDbSize = statSync(runtimeDbPath).size;
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  function getDiskUsage() {
    try {
      const stats = fs.statfsSync ? fs.statfsSync("/") : null;

      if (!stats) return null;

      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;

      return {
        totalGB: (total / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (used / 1024 / 1024 / 1024).toFixed(2),
        freeGB: (free / 1024 / 1024 / 1024).toFixed(2),
      };
    } catch {
      return null;
    }
  }
    
  function getActiveConnectionsApprox() {
    try {
      const data = fs.readFileSync("/proc/net/tcp", "utf8");
      return data.split("\n").length - 1;
    } catch {
      return null;
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    maintenanceMode: appConfig.telegramMaintenanceMode,
    botEnabled: appConfig.telegramBotEnabled,
    adminCount: appConfig.telegramAdminIds.length,
    webHealthOk: await checkWebHealth(),
    runtimeDb: {
      path: runtimeDbPath,
      sizeBytes: runtimeDbSize,
    },
    downloadsDir: {
      path: appConfig.downloadsDir,
      writable: checkDownloadsDirWritable(),
    },
    binaries: {
      ytDlp: await checkBinary(appConfig.ytDlpBin, ["--version"]),
      ffmpeg: await checkBinary(appConfig.ffmpegBin, ["-version"]),
    },
    queue: getQueueSnapshot(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    diskUsage: getDiskUsage(),

    cpuModel: cpus[0]?.model,
    cpuCores: cpus.length,

    loadAvg: os.loadavg(), // 1m, 5m, 15m

    activeConnectionsApprox: getActiveConnectionsApprox(),
    
    totalMemoryMB: Math.round(totalMem / 1024 / 1024),
    freeMemoryMB: Math.round(freeMem / 1024 / 1024),
    usedMemoryMB: Math.round((totalMem - freeMem) / 1024 / 1024),

    uptimeSec: os.uptime(),

    nodeVersion: process.version,

    processMemoryMB: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };
}
