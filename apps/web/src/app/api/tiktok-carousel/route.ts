import { NextResponse } from "next/server";
import { scrapeTikTokCarousel } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/tiktok-carousel
 * Body: { url: string }
 * Returns: { images: string[], title: string, cover: string, postId: string, audioUrl: string } | { error: string }
 *
 * Uses the shared core scraper (Tikwm API) to extract photo carousel data.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const info = await scrapeTikTokCarousel(rawUrl);

    return NextResponse.json({
      images: info.images,
      title: info.title,
      cover: info.thumbnail,
      postId: info.postId || "",
      audioUrl: info.resolvedUrl || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
