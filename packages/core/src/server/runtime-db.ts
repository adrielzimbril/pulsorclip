import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "./config";
import type { AppLocale, DownloadMode, DownloadJob } from "../shared/types";
import { logServer } from "./logger";

type CounterKind = "created" | "completed";

type BotUserPreferences = {
  locale?: AppLocale;
  mode?: DownloadMode;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

const runtimeDir = join(appConfig.downloadsDir, ".runtime");
const sqliteDbPath = join(runtimeDir, "pulsorclip.db");
const legacyDbPath = join(runtimeDir, "pulsorclip-runtime.json");

let _db: Database.Database | null = null;

/**
 * Lazy-getter for the SQLite database.
 * This avoids opening the DB at module load time (important for Next.js builds).
 */
function getDb() {
  if (_db) return _db;
  
  // Ensure directory exists
  mkdirSync(runtimeDir, { recursive: true });

  // Initialize Database with reasonable timeout for locks
  _db = new Database(sqliteDbPath, { timeout: 10000 });
  _db.pragma("journal_mode = WAL");

  // Migration / Schema Setup
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      preferences TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      bot_users TEXT NOT NULL DEFAULT '[]',
      downloads_created_web INTEGER DEFAULT 0,
      downloads_created_bot INTEGER DEFAULT 0,
      downloads_completed_web INTEGER DEFAULT 0,
      downloads_completed_bot INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queue (
      job_id TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      added_at TEXT NOT NULL
    );
  `);

  // Legacy JSON Data Migration
  if (existsSync(legacyDbPath)) {
    try {
      const data = JSON.parse(readFileSync(legacyDbPath, "utf-8"));
      
      _db.transaction(() => {
        // Migrate users
        if (data.botUsers) {
          const stmt = _db!.prepare("INSERT OR REPLACE INTO users (id, preferences, last_seen_at) VALUES (?, ?, ?)");
          for (const [id, prefs] of Object.entries(data.botUsers)) {
            stmt.run(id, JSON.stringify(prefs), (prefs as any).lastSeenAt || new Date().toISOString());
          }
        }

        // Migrate jobs
        if (data.jobs) {
          const stmt = _db!.prepare("INSERT OR REPLACE INTO jobs (id, payload, updated_at) VALUES (?, ?, ?)");
          for (const [id, job] of Object.entries(data.jobs)) {
            stmt.run(id, JSON.stringify(job), new Date().toISOString());
          }
        }

        // Migrate queue
        if (data.queue && Array.isArray(data.queue)) {
          const stmt = _db!.prepare("INSERT OR REPLACE INTO queue (job_id, position, added_at) VALUES (?, ?, ?)");
          data.queue.forEach((jobId: string, index: number) => {
            stmt.run(jobId, index, new Date().toISOString());
          });
        }

        // Migrate daily stats
        if (data.daily) {
          const stmt = _db!.prepare(`
            INSERT OR REPLACE INTO daily_stats 
            (date, bot_users, downloads_created_web, downloads_created_bot, downloads_completed_web, downloads_completed_bot) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const [date, row] of Object.entries(data.daily as any)) {
            const r = row as any;
            stmt.run(
              date,
              JSON.stringify(r.botUsers || []),
              r.downloadsCreated?.web || 0,
              r.downloadsCreated?.bot || 0,
              r.downloadsCompleted?.web || 0,
              r.downloadsCompleted?.bot || 0
            );
          }
        }
      })();

      logServer("info", "db.migration.completed", { source: legacyDbPath });
      // Backup legacy file
      try {
        const backupPath = `${legacyDbPath}.bak`;
        if (!existsSync(backupPath)) {
          writeFileSync(backupPath, readFileSync(legacyDbPath));
          unlinkSync(legacyDbPath);
        }
      } catch {
        // Ignore backup error
      }
    } catch (err) {
      logServer("error", "db.migration.failed", { error: String(err) });
    }
  }

  return _db;
}

function timestamp() {
  return new Date().toISOString();
}

function utcDateKey(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

export function getRuntimeDbPath() {
  return sqliteDbPath;
}

export function getStoredUserPreferences(userId?: number): BotUserPreferences {
  if (!userId) return {};
  const row = getDb().prepare("SELECT preferences FROM users WHERE id = ?").get(String(userId)) as { preferences: string } | undefined;
  return row ? JSON.parse(row.preferences) : {};
}

export function setStoredUserLocale(userId: number | undefined, locale: AppLocale) {
  if (!userId) return;
  const id = String(userId);
  const now = timestamp();
  const current = getStoredUserPreferences(userId);
  const updated = { ...current, locale, firstSeenAt: current.firstSeenAt || now, lastSeenAt: now };
  getDb().prepare("INSERT OR REPLACE INTO users (id, preferences, last_seen_at) VALUES (?, ?, ?)").run(id, JSON.stringify(updated), now);
}

export function setStoredUserMode(userId: number | undefined, mode: DownloadMode) {
  if (!userId) return;
  const id = String(userId);
  const now = timestamp();
  const current = getStoredUserPreferences(userId);
  const updated = { ...current, mode, firstSeenAt: current.firstSeenAt || now, lastSeenAt: now };
  getDb().prepare("INSERT OR REPLACE INTO users (id, preferences, last_seen_at) VALUES (?, ?, ?)").run(id, JSON.stringify(updated), now);
}

export function trackStoredBotUser(userId?: number) {
  if (!userId) return;
  const id = String(userId);
  const now = timestamp();
  const date = utcDateKey();
  
  // Update user last seen
  const current = getStoredUserPreferences(userId);
  const updated = { ...current, firstSeenAt: current.firstSeenAt || now, lastSeenAt: now };
  getDb().prepare("INSERT OR REPLACE INTO users (id, preferences, last_seen_at) VALUES (?, ?, ?)").run(id, JSON.stringify(updated), now);

  // Update daily stats users list
  const row = getDb().prepare("SELECT bot_users FROM daily_stats WHERE date = ?").get(date) as { bot_users: string } | undefined;
  let botUsers = row ? JSON.parse(row.bot_users) : [];
  if (!botUsers.includes(userId)) {
    botUsers.push(userId);
    getDb().prepare("INSERT INTO daily_stats (date, bot_users) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET bot_users = ?")
      .run(date, JSON.stringify(botUsers), JSON.stringify(botUsers));
  }
}

export function incrementDailyCounter(source: "web" | "bot", kind: CounterKind) {
  const date = utcDateKey();
  const column = kind === "created" ? `downloads_created_${source}` : `downloads_completed_${source}`;
  getDb().prepare(`
    INSERT INTO daily_stats (date, ${column}) 
    VALUES (?, 1) 
    ON CONFLICT(date) DO UPDATE SET ${column} = ${column} + 1
  `).run(date);
}

export function getStoredDailySummary(date = utcDateKey()) {
  const row = getDb().prepare("SELECT * FROM daily_stats WHERE date = ?").get(date) as any;
  if (!row) {
    return {
      date,
      botUsers: 0,
      downloadsCreated: { web: 0, bot: 0 },
      downloadsCompleted: { web: 0, bot: 0 },
    };
  }
  return {
    date: row.date,
    botUsers: JSON.parse(row.bot_users).length,
    downloadsCreated: { web: row.downloads_created_web, bot: row.downloads_created_bot },
    downloadsCompleted: { web: row.downloads_completed_web, bot: row.downloads_completed_bot },
  };
}

export function flushStoredDailySummary(date = utcDateKey(-1)) {
  const summary = getStoredDailySummary(date);
  getDb().prepare("DELETE FROM daily_stats WHERE date = ?").run(date);
  return summary;
}

export function getStoredJobs(): Record<string, DownloadJob> {
  const rows = getDb().prepare("SELECT id, payload FROM jobs").all() as { id: string, payload: string }[];
  const result: Record<string, DownloadJob> = {};
  for (const row of rows) {
    result[row.id] = JSON.parse(row.payload);
  }
  return result;
}

export function getStoredJob(jobId: string): DownloadJob | null {
  const row = getDb().prepare("SELECT payload FROM jobs WHERE id = ?").get(jobId) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) : null;
}

export function getStoredQueue(): string[] {
  const rows = getDb().prepare("SELECT job_id FROM queue ORDER BY position ASC").all() as { job_id: string }[];
  return rows.map(r => r.job_id);
}

export function writeStoredJob(job: DownloadJob) {
  const now = timestamp();
  getDb().prepare("INSERT OR REPLACE INTO jobs (id, payload, updated_at) VALUES (?, ?, ?)")
    .run(job.id, JSON.stringify(job), now);
}

export function writeStoredJobs(jobsMap: Record<string, DownloadJob>, queueList: string[]) {
  const now = timestamp();
  getDb().transaction(() => {
    // Delete jobs not in the map
    const jobIds = Object.keys(jobsMap);
    if (jobIds.length > 0) {
      getDb().prepare(`DELETE FROM jobs WHERE id NOT IN (${jobIds.map(() => "?").join(",")})`).run(...jobIds);
    } else {
      getDb().prepare("DELETE FROM jobs").run();
    }

    // Insert or replace jobs
    const insertJob = getDb().prepare("INSERT OR REPLACE INTO jobs (id, payload, updated_at) VALUES (?, ?, ?)");
    for (const [id, job] of Object.entries(jobsMap)) {
      insertJob.run(id, JSON.stringify(job), now);
    }

    // Update queue
    getDb().prepare("DELETE FROM queue").run();
    const insertQueue = getDb().prepare("INSERT INTO queue (job_id, position, added_at) VALUES (?, ?, ?)");
    queueList.forEach((jobId, index) => {
      insertQueue.run(jobId, index, now);
    });
  })();
}
