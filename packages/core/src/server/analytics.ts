import type { JobSource } from "../shared/types";

type DailyBucket = {
  date: string;
  botUsers: Set<number>;
  downloadsCreated: Record<JobSource, number>;
  downloadsCompleted: Record<JobSource, number>;
};

declare global {
  var __pulsorclipDailyBucket: DailyBucket | undefined;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createBucket(date: string): DailyBucket {
  return {
    date,
    botUsers: new Set<number>(),
    downloadsCreated: { web: 0, bot: 0 },
    downloadsCompleted: { web: 0, bot: 0 },
  };
}

function ensureBucket() {
  const key = todayKey();
  const current = global.__pulsorclipDailyBucket;

  if (!current || current.date !== key) {
    global.__pulsorclipDailyBucket = createBucket(key);
  }

  return global.__pulsorclipDailyBucket as DailyBucket;
}

export function trackBotUser(userId?: number) {
  if (!userId) {
    return;
  }

  ensureBucket().botUsers.add(userId);
}

export function trackDownloadCreated(source: JobSource) {
  ensureBucket().downloadsCreated[source] += 1;
}

export function trackDownloadCompleted(source: JobSource) {
  ensureBucket().downloadsCompleted[source] += 1;
}

export function getDailySummary() {
  const bucket = ensureBucket();

  return {
    date: bucket.date,
    botUsers: bucket.botUsers.size,
    downloadsCreated: { ...bucket.downloadsCreated },
    downloadsCompleted: { ...bucket.downloadsCompleted },
  };
}

export function flushDailySummary() {
  const bucket = (global.__pulsorclipDailyBucket ?? createBucket(todayKey())) as DailyBucket;
  const snapshot = {
    date: bucket.date,
    botUsers: bucket.botUsers.size,
    downloadsCreated: { ...bucket.downloadsCreated },
    downloadsCompleted: { ...bucket.downloadsCompleted },
  };

  global.__pulsorclipDailyBucket = createBucket(todayKey());

  return snapshot;
}
