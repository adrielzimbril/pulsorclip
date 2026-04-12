import type { JobSource } from "../shared/types";
import {
  flushStoredDailySummary,
  getStoredDailySummary,
  incrementDailyCounter,
  getStoredMetadata,
  setStoredMetadata,
  trackStoredBotUser,
} from "./runtime-db";

export function trackBotUser(userId?: number) {
  trackStoredBotUser(userId);
}

export function trackDownloadCreated(source: JobSource) {
  incrementDailyCounter(source, "created");
}

export function trackDownloadCompleted(source: JobSource) {
  incrementDailyCounter(source, "completed");
}

export function getDailySummary() {
  return getStoredDailySummary();
}

export function flushDailySummary() {
  return flushStoredDailySummary();
}

export function getMetadata(key: string) {
  return getStoredMetadata(key);
}

export function setMetadata(key: string, value: string) {
  setStoredMetadata(key, value);
}
