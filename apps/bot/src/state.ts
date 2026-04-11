import type { DownloadMode } from "@pulsorclip/core/shared";
import type { PendingChoice } from "./types";

export const pendingByChat = new Map<number, PendingChoice>();
export const modeByChat = new Map<number, DownloadMode>();

// Queuing system
export type QueuedRequest = {
  url: string;
  mode: DownloadMode;
  requestId: number;
};

export const userQueues = new Map<number, QueuedRequest[]>();
export const userProcessing = new Map<number, boolean>();
export const userRequestCounter = new Map<number, number>();
