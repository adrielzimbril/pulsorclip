import { NextResponse } from "next/server";
import { fetchMediaInfo } from "@pulsorclip/core/server";
import { infoRequestSchema } from "@pulsorclip/core/shared";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const payload = infoRequestSchema.parse(await request.json());
    const info = await fetchMediaInfo(payload.url);
    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
