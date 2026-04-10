import { NextResponse } from "next/server";
import { fetchMediaInfo, logServer, urlForLogs } from "@pulsorclip/core/server";
import { infoRequestSchema } from "@pulsorclip/core/shared";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const payload = infoRequestSchema.parse(await request.json());
    logServer("info", "api.info.request", {
      source: "web",
      url: urlForLogs(payload.url),
    });
    const info = await fetchMediaInfo(payload.url);
    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    logServer("warn", "api.info.failed", {
      source: "web",
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
