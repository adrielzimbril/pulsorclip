import { z } from "zod";

export const infoRequestSchema = z.object({
  url: z.url(),
});

export const downloadRequestSchema = z.object({
  url: z.url(),
  format: z.enum(["video", "audio"]).default("video"),
  format_id: z.string().trim().min(1).max(40).optional().nullable(),
  title: z.string().max(300).optional().default(""),
});
