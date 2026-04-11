import { NextResponse } from "next/server";
import { cancelDownloadJob, listDownloadJobs } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const jobs = listDownloadJobs("web").slice(0, 30);

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      url: job.url,
      mode: job.mode,
      status: job.status,
      progress: job.progress,
      progressLabel: job.progressLabel || null,
      queuePosition: job.queuePosition || 0,
      error: job.error || null,
      filename: job.filename || null,
      createdAt: job.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { action?: string; jobId?: string };

    if (payload.action !== "cancel" || !payload.jobId) {
      return NextResponse.json({ error: "Invalid queue action" }, { status: 400 });
    }

    const cancelled = cancelDownloadJob(payload.jobId);

    if (!cancelled) {
      return NextResponse.json({ error: "Job cannot be cancelled" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
