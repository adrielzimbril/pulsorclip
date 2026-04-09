import type { DownloadMode } from "@pulsorclip/core/shared";
import type { PendingChoice } from "./types";

export const pendingByChat = new Map<number, PendingChoice>();
export const modeByChat = new Map<number, DownloadMode>();
