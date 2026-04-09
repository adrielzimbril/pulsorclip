import { NextResponse } from "next/server";
import { createDownloadJob } from "@pulsorclip/core/server";
import { downloadRequestSchema } from "@pulsorclip/core/shared";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const payload = downloadRequestSchema.parse(await request.json());
    const job = createDownloadJob(payload);
    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
