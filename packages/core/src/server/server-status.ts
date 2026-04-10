import { statSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getQueueSnapshot } from "./downloader";
import { appConfig } from "./config";
import { runCommand } from "./process";
import { getRuntimeDbPath } from "./runtime-db";

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
  };
}
