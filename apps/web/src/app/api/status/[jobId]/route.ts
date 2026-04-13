import { NextResponse } from "next/server";
import { getDownloadJob } from "@pulsorclip/core/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  let userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    userId = crypto.randomUUID();
    cookieStore.set("user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return userId;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const userId = await getUserId();
  const job = getDownloadJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.userId && job.userId !== userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    progressLabel: job.progressLabel || null,
    queuePosition: job.queuePosition || 0,
    error: job.error || null,
    filename: job.filename || null,
    title: job.title || null,
    thumbnail: job.thumbnail || null,
  });
}
