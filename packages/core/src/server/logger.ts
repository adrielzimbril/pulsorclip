import { URL } from "node:url";
import { appConfig } from "./config";

type LogLevel = "info" | "warn" | "error" | "debug";

function redactUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

function basePayload(payload?: Record<string, unknown>) {
  return {
    ts: new Date().toISOString(),
    app: appConfig.appName,
    ...(payload || {}),
  };
}

function shouldLog(level: LogLevel) {
  if (level !== "debug") {
    return true;
  }

  return appConfig.debugLogs;
}

export function logServer(level: LogLevel, event: string, payload?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    level,
    event,
    ...basePayload(payload),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error("🛑 ERROR: " + line);
    return;
  }

  if (level === "warn") {
    console.warn("⚠️ WARN: " + line);
    return;
  }

  if (level === "debug") {
    console.debug("🔍 DEBUG: " + line);
    return;
  }

  if (level === "info") {
    console.info("ℹ️ INFO: " + line);
    return;
  }

  console.log("📄 LOG: " + line);
}

export function urlForLogs(rawUrl: string) {
  return appConfig.logFullUrls ? rawUrl : redactUrl(rawUrl);
}

export function stderrTail(raw: string, lines = 6) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lines);
}
