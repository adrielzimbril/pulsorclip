import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireCompletedJob } from "@pulsorclip/core/server";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const userId = await getUserId();
  const job = requireCompletedJob(jobId);

  if (!job?.filePath || !job.filename) {
    return NextResponse.json({ error: "File not ready" }, { status: 404 });
  }

  if (job.userId && job.userId !== userId) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stream = createReadStream(job.filePath);

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": job.size.toString(),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
