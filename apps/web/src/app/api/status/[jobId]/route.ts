import { NextResponse } from "next/server";
import { getDownloadJob } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = getDownloadJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    progressLabel: job.progressLabel || null,
    queuePosition: job.queuePosition || 0,
    error: job.error || null,
    filename: job.filename || null,
    job: job,
  });
}
