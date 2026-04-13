import { z } from "zod";

export const infoRequestSchema = z.object({
  url: z.url(),
});

export const downloadRequestSchema = z.object({
  url: z.url(),
  mode: z.enum(["video", "audio"]).default("video"),
  formatId: z.string().trim().min(1).max(80).optional().nullable(),
  targetExt: z.enum(["mp4", "webm", "mkv", "mp3", "m4a"]).optional().nullable(),
  title: z.string().trim().max(300).optional().default(""),
  source: z.enum(["web", "bot"]).optional().default("web"),
  resolvedUrl: z.string().url().trim().optional().nullable(),
  resolvedVideoUrl: z.string().url().trim().optional().nullable(),
  thumbnail: z.string().trim().url().optional().nullable(),
});
