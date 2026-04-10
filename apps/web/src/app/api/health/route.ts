import { NextResponse } from "next/server";
import { appConfig } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "web",
    app: appConfig.appName,
    timestamp: new Date().toISOString(),
  });
}
