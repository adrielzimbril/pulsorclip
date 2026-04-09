import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireCompletedJob } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = requireCompletedJob(jobId);

  if (!job?.filePath || !job.filename) {
    return NextResponse.json({ error: "File not ready" }, { status: 404 });
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
