import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appConfig } from "@pulsorclip/core/server";
import type { AppLocale, DownloadMode } from "@pulsorclip/core/shared";

type BotUserPreferences = {
  locale?: AppLocale;
  mode?: DownloadMode;
};

type PreferenceStore = Record<string, BotUserPreferences>;

const storePath = join(appConfig.downloadsDir, ".runtime", "bot-preferences.json");

function ensureStoreDir() {
  mkdirSync(dirname(storePath), { recursive: true });
}

function readStore(): PreferenceStore {
  ensureStoreDir();

  if (!existsSync(storePath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(storePath, "utf8")) as PreferenceStore;
  } catch {
    return {};
  }
}

function writeStore(store: PreferenceStore) {
  ensureStoreDir();
  writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function keyForUser(userId?: number) {
  return userId ? String(userId) : null;
}

export function getUserPreferences(userId?: number): BotUserPreferences {
  const key = keyForUser(userId);

  if (!key) {
    return {};
  }

  return readStore()[key] || {};
}

export function setUserLocale(userId: number | undefined, locale: AppLocale) {
  const key = keyForUser(userId);

  if (!key) {
    return;
  }

  const store = readStore();
  store[key] = { ...store[key], locale };
  writeStore(store);
}

export function setUserMode(userId: number | undefined, mode: DownloadMode) {
  const key = keyForUser(userId);

  if (!key) {
    return;
  }

  const store = readStore();
  store[key] = { ...store[key], mode };
  writeStore(store);
}
