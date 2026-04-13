import { NextResponse } from "next/server";
import { cancelDownloadJob, listDownloadJobs } from "@pulsorclip/core/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 300;

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

export async function GET() {
  const userId = await getUserId();
  const jobs = listDownloadJobs("web", userId).slice(0, 30);

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
    const payload = (await request.json()) as {
      action?: string;
      jobId?: string;
    };

    if (payload.action !== "cancel" || !payload.jobId) {
      return NextResponse.json(
        { error: "Invalid queue action" },
        { status: 400 },
      );
    }

    const userId = await getUserId();
    const jobs = listDownloadJobs("web", userId);
    const job = jobs.find((j) => j.id === payload.jobId);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found or not owned by you" },
        { status: 404 },
      );
    }

    const cancelled = cancelDownloadJob(payload.jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: "Job cannot be cancelled" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Queue action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
