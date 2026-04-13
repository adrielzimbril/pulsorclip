import { NextResponse } from "next/server";
import {
  createDownloadJob,
  logServer,
  urlForLogs,
} from "@pulsorclip/core/server";
import { downloadRequestSchema } from "@pulsorclip/core/shared";
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

export async function POST(request: Request) {
  try {
    const payload = downloadRequestSchema.parse(await request.json());
    const userId = await getUserId();

    logServer("info", "api.download.request", {
      source: "web",
      url: urlForLogs(payload.url),
      mode: payload.mode,
      targetExt: payload.targetExt,
      formatId: payload.formatId,
      userId,
    });

    const job = createDownloadJob({ ...payload, userId });
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
