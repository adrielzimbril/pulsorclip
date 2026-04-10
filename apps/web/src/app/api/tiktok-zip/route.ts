import { NextResponse } from "next/server";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/tiktok-zip
 * Body: { imageUrls: string[], title?: string }
 * Returns: ZIP binary stream with all selected images.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { imageUrls?: string[]; title?: string };

    if (!Array.isArray(body.imageUrls) || body.imageUrls.length === 0) {
      return NextResponse.json({ error: "No image URLs provided" }, { status: 400 });
    }

    const imageUrls = body.imageUrls.slice(0, 50);
    const title = (body.title || "tiktok-carousel").replace(/[^\w\s-]/g, "").trim() || "tiktok-carousel";

    // Fetch all images concurrently
    const fetched = await Promise.allSettled(
      imageUrls.map(async (url, index) => {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            Referer: "https://www.tiktok.com/",
          },
        });
        if (!res.ok) throw new Error(`Failed to fetch image ${index + 1}: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        return { buffer, filename: `image-${String(index + 1).padStart(3, "0")}.${ext}` };
      }),
    );

    // Build ZIP using jszip (excellent TypeScript support, no native deps)
    const zip = new JSZip();

    for (const result of fetched) {
      if (result.status === "fulfilled") {
        zip.file(result.value.filename, result.value.buffer);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const safeTitle = title.slice(0, 64);
    // Use underlying ArrayBuffer to avoid Uint8Array<ArrayBuffer> generic conflicts with NextResponse
    const arrayBuffer: ArrayBuffer = zipBuffer.buffer as ArrayBuffer;

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.zip"`,
        "Content-Length": arrayBuffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
