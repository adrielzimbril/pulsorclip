import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { appConfig } from "./config";
import type { AppLocale, DownloadMode } from "../shared/types";

type CounterKind = "created" | "completed";
type BotUserPreferences = {
  locale?: AppLocale;
  mode?: DownloadMode;
};

const runtimeDir = join(appConfig.downloadsDir, ".runtime");
const runtimeDbPath = join(runtimeDir, "pulsorclip-runtime.sqlite");

mkdirSync(dirname(runtimeDbPath), { recursive: true });

const database = new DatabaseSync(runtimeDbPath);

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS bot_users (
    user_id INTEGER PRIMARY KEY,
    locale TEXT,
    mode TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bot_daily_users (
    bucket_date TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (bucket_date, user_id)
  );

  CREATE TABLE IF NOT EXISTS daily_counters (
    bucket_date TEXT NOT NULL,
    source TEXT NOT NULL,
    created_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_date, source)
  );
`);

const upsertUserStatement = database.prepare(`
  INSERT INTO bot_users (user_id, locale, mode, first_seen_at, last_seen_at)
  VALUES (?, NULL, NULL, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
`);

const upsertDailyUserStatement = database.prepare(`
  INSERT OR IGNORE INTO bot_daily_users (bucket_date, user_id)
  VALUES (?, ?)
`);

const getUserStatement = database.prepare(`
  SELECT locale, mode
  FROM bot_users
  WHERE user_id = ?
`);

const setLocaleStatement = database.prepare(`
  INSERT INTO bot_users (user_id, locale, mode, first_seen_at, last_seen_at)
  VALUES (?, ?, NULL, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    locale = excluded.locale,
    last_seen_at = excluded.last_seen_at
`);

const setModeStatement = database.prepare(`
  INSERT INTO bot_users (user_id, locale, mode, first_seen_at, last_seen_at)
  VALUES (?, NULL, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    mode = excluded.mode,
    last_seen_at = excluded.last_seen_at
`);

const ensureCounterStatement = database.prepare(`
  INSERT OR IGNORE INTO daily_counters (bucket_date, source, created_count, completed_count)
  VALUES (?, ?, 0, 0)
`);

const incrementCreatedStatement = database.prepare(`
  UPDATE daily_counters
  SET created_count = created_count + 1
  WHERE bucket_date = ? AND source = ?
`);

const incrementCompletedStatement = database.prepare(`
  UPDATE daily_counters
  SET completed_count = completed_count + 1
  WHERE bucket_date = ? AND source = ?
`);

const getDailyUsersStatement = database.prepare(`
  SELECT COUNT(*) AS count
  FROM bot_daily_users
  WHERE bucket_date = ?
`);

const getDailyCounterStatement = database.prepare(`
  SELECT source, created_count, completed_count
  FROM daily_counters
  WHERE bucket_date = ?
`);

const deleteDailyUsersStatement = database.prepare(`
  DELETE FROM bot_daily_users
  WHERE bucket_date = ?
`);

const deleteDailyCountersStatement = database.prepare(`
  DELETE FROM daily_counters
  WHERE bucket_date = ?
`);

function utcDateKey(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

function timestamp() {
  return new Date().toISOString();
}

function coerceLocale(value: unknown): AppLocale | undefined {
  return value === "fr" || value === "en" ? value : undefined;
}

function coerceMode(value: unknown): DownloadMode | undefined {
  return value === "video" || value === "audio" ? value : undefined;
}

function ensureCounterRow(bucketDate: string, source: "web" | "bot") {
  ensureCounterStatement.run(bucketDate, source);
}

export function getRuntimeDbPath() {
  return runtimeDbPath;
}

export function getStoredUserPreferences(userId?: number): BotUserPreferences {
  if (!userId) {
    return {};
  }

  const row = getUserStatement.get(userId) as { locale: unknown; mode: unknown } | undefined;

  if (!row) {
    return {};
  }

  return {
    locale: coerceLocale(row.locale),
    mode: coerceMode(row.mode),
  };
}

export function setStoredUserLocale(userId: number | undefined, locale: AppLocale) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  setLocaleStatement.run(userId, locale, now, now);
}

export function setStoredUserMode(userId: number | undefined, mode: DownloadMode) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  setModeStatement.run(userId, mode, now, now);
}

export function trackStoredBotUser(userId?: number) {
  if (!userId) {
    return;
  }

  const now = timestamp();
  const bucketDate = utcDateKey();
  upsertUserStatement.run(userId, now, now);
  upsertDailyUserStatement.run(bucketDate, userId);
}

export function incrementDailyCounter(source: "web" | "bot", kind: CounterKind) {
  const bucketDate = utcDateKey();
  ensureCounterRow(bucketDate, source);

  if (kind === "created") {
    incrementCreatedStatement.run(bucketDate, source);
    return;
  }

  incrementCompletedStatement.run(bucketDate, source);
}

export function getStoredDailySummary(bucketDate = utcDateKey()) {
  const userRow = getDailyUsersStatement.get(bucketDate) as { count: number } | undefined;
  const counterRows = getDailyCounterStatement.all(bucketDate) as Array<{
    source: "web" | "bot";
    created_count: number;
    completed_count: number;
  }>;

  const downloadsCreated = { web: 0, bot: 0 };
  const downloadsCompleted = { web: 0, bot: 0 };

  for (const row of counterRows) {
    downloadsCreated[row.source] = row.created_count;
    downloadsCompleted[row.source] = row.completed_count;
  }

  return {
    date: bucketDate,
    botUsers: Number(userRow?.count || 0),
    downloadsCreated,
    downloadsCompleted,
  };
}

export function flushStoredDailySummary(bucketDate = utcDateKey(-1)) {
  const summary = getStoredDailySummary(bucketDate);
  deleteDailyUsersStatement.run(bucketDate);
  deleteDailyCountersStatement.run(bucketDate);
  return summary;
}
