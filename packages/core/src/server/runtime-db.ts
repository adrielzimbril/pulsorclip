import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appConfig } from "./config";
import type { AppLocale, DownloadMode } from "../shared/types";

type CounterKind = "created" | "completed";

type BotUserPreferences = {
  locale?: AppLocale;
  mode?: DownloadMode;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

type DailySummaryRow = {
  botUsers: number[];
  downloadsCreated: { web: number; bot: number };
  downloadsCompleted: { web: number; bot: number };
};

type RuntimeStore = {
  botUsers: Record<string, BotUserPreferences>;
  daily: Record<string, DailySummaryRow>;
};

const runtimeDir = join(appConfig.downloadsDir, ".runtime");
const runtimeDbPath = join(runtimeDir, "pulsorclip-runtime.json");

function ensureStoreDir() {
  mkdirSync(dirname(runtimeDbPath), { recursive: true });
}

function createEmptyStore(): RuntimeStore {
  return {
    botUsers: {},
    daily: {},
  };
}

function readStore(): RuntimeStore {
  ensureStoreDir();

  if (!existsSync(runtimeDbPath)) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(readFileSync(runtimeDbPath, "utf8")) as RuntimeStore;
    return {
      botUsers: parsed.botUsers || {},
      daily: parsed.daily || {},
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store: RuntimeStore) {
  ensureStoreDir();
  writeFileSync(runtimeDbPath, JSON.stringify(store, null, 2), "utf8");
}

function utcDateKey(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

function timestamp() {
  return new Date().toISOString();
}

function ensureDailyRow(store: RuntimeStore, bucketDate: string) {
  if (!store.daily[bucketDate]) {
    store.daily[bucketDate] = {
      botUsers: [],
      downloadsCreated: { web: 0, bot: 0 },
      downloadsCompleted: { web: 0, bot: 0 },
    };
  }

  return store.daily[bucketDate];
}

export function getRuntimeDbPath() {
  return runtimeDbPath;
}

export function getStoredUserPreferences(userId?: number): BotUserPreferences {
  if (!userId) {
    return {};
  }

  const store = readStore();
  return store.botUsers[String(userId)] || {};
}

export function setStoredUserLocale(userId: number | undefined, locale: AppLocale) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  const key = String(userId);
  const store = readStore();
  const current = store.botUsers[key] || {};
  store.botUsers[key] = {
    ...current,
    locale,
    firstSeenAt: current.firstSeenAt || now,
    lastSeenAt: now,
  };
  writeStore(store);
}

export function setStoredUserMode(userId: number | undefined, mode: DownloadMode) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  const key = String(userId);
  const store = readStore();
  const current = store.botUsers[key] || {};
  store.botUsers[key] = {
    ...current,
    mode,
    firstSeenAt: current.firstSeenAt || now,
    lastSeenAt: now,
  };
  writeStore(store);
}

export function trackStoredBotUser(userId?: number) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  const key = String(userId);
  const bucketDate = utcDateKey();
  const store = readStore();
  const current = store.botUsers[key] || {};

  store.botUsers[key] = {
    ...current,
    firstSeenAt: current.firstSeenAt || now,
    lastSeenAt: now,
  };

  const row = ensureDailyRow(store, bucketDate);
  if (!row.botUsers.includes(userId)) {
    row.botUsers.push(userId);
  }

  writeStore(store);
}

export function incrementDailyCounter(source: "web" | "bot", kind: CounterKind) {
  const store = readStore();
  const row = ensureDailyRow(store, utcDateKey());

  if (kind === "created") {
    row.downloadsCreated[source] += 1;
  } else {
    row.downloadsCompleted[source] += 1;
  }

  writeStore(store);
}

export function getStoredDailySummary(bucketDate = utcDateKey()) {
  const store = readStore();
  const row = ensureDailyRow(store, bucketDate);

  return {
    date: bucketDate,
    botUsers: row.botUsers.length,
    downloadsCreated: { ...row.downloadsCreated },
    downloadsCompleted: { ...row.downloadsCompleted },
  };
}

export function flushStoredDailySummary(bucketDate = utcDateKey(-1)) {
  const store = readStore();
  const row = ensureDailyRow(store, bucketDate);
  const summary = {
    date: bucketDate,
    botUsers: row.botUsers.length,
    downloadsCreated: { ...row.downloadsCreated },
    downloadsCompleted: { ...row.downloadsCompleted },
  };

  delete store.daily[bucketDate];
  writeStore(store);

  return summary;
}
