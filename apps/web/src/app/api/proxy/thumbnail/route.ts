import { NextResponse } from "next/server";
import { fetchThumbnailBuffer } from "@pulsorclip/core/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("URL parameter is required", { status: 400 });
  }

  try {
    const buffer = await fetchThumbnailBuffer(imageUrl);
    if (!buffer) {
      // Return a 1x1 transparent GIF as fallback or just 404
      return new NextResponse("Failed to fetch thumbnail", { status: 404 });
    }

    // Guess content type from extension
    let contentType = "image/jpeg";
    if (imageUrl.toLowerCase().includes(".png")) contentType = "image/png";
    if (imageUrl.toLowerCase().includes(".webp")) contentType = "image/webp";
    if (imageUrl.toLowerCase().includes(".gif")) contentType = "image/gif";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Thumbnail proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
