import { NextResponse } from "next/server";
import { createDownloadJob, logServer, urlForLogs } from "@pulsorclip/core/server";
import { downloadRequestSchema } from "@pulsorclip/core/shared";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const payload = downloadRequestSchema.parse(await request.json());
    logServer("info", "api.download.request", {
      source: "web",
      url: urlForLogs(payload.url),
      mode: payload.mode,
      targetExt: payload.targetExt,
      formatId: payload.formatId,
    });
    const job = createDownloadJob(payload);
    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    logServer("warn", "api.download.failed", {
      source: "web",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
