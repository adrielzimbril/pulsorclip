import { NextResponse } from "next/server";
import {
  fetchThumbnailBuffer,
  getStoredThumbnail,
} from "@pulsorclip/core/server";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("URL parameter is required", { status: 400 });
  }

  try {
    // First check if thumbnail is already cached in database
    const cached = getStoredThumbnail(imageUrl);
    let buffer: Buffer | null = null;
    let contentType = "image/jpeg";

    if (cached && existsSync(cached.file_path)) {
      // Serve from cache
      buffer = readFileSync(cached.file_path);
      contentType = cached.content_type;
      console.log(`[Thumbnail Proxy] Cache hit for ${imageUrl}`);
    } else {
      // Fetch and cache
      buffer = await fetchThumbnailBuffer(imageUrl);
      if (!buffer) {
        return new NextResponse("Failed to fetch thumbnail", { status: 404 });
      }

      // Guess content type from extension if not in cache
      if (imageUrl.toLowerCase().includes(".png")) contentType = "image/png";
      if (imageUrl.toLowerCase().includes(".webp")) contentType = "image/webp";
      if (imageUrl.toLowerCase().includes(".gif")) contentType = "image/gif";
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Thumbnail proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
