import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Resolves a short TikTok URL (vm.tiktok.com) to its canonical URL.
 */
async function resolveShortUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      },
    });
    return res.url || url;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/tiktok-carousel
 * Body: { url: string }
 * Returns: { images: string[], title: string, cover: string } | { error: string }
 *
 * Uses the tikwm.com public API (no account required) to extract photo diaporama data.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Resolve short URLs (vm.tiktok.com) to canonical form
    let resolvedUrl = rawUrl;
    if (rawUrl.includes("vm.tiktok.com") || rawUrl.includes("vt.tiktok.com")) {
      resolvedUrl = await resolveShortUrl(rawUrl);
    }

    // Call tikwm.com public API — no account or API key required
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}&count=12&cursor=0&web=1&hd=1`;

    const apiRes = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PulsorClip/1.0)",
        Accept: "application/json",
      },
    });

    if (!apiRes.ok) {
      return NextResponse.json(
        { error: `tikwm API error: ${apiRes.statusText}` },
        { status: 502 },
      );
    }

    const data = (await apiRes.json()) as {
      code?: number;
      msg?: string;
      data?: {
        id?: string;
        title?: string;
        cover?: string;
        images?: string[];
        play?: string;
        // photo post specific fields
        image_post_info?: {
          images?: { display_image?: { url_list?: string[] } }[];
        };
      };
    };

    if (data.code !== 0 || !data.data) {
      return NextResponse.json(
        { error: data.msg || "Could not extract TikTok carousel data" },
        { status: 422 },
      );
    }

    const mediaData = data.data;

    // Extract images — tikwm returns `images` array for photo diaporamas
    let images: string[] = [];

    if (Array.isArray(mediaData.images) && mediaData.images.length > 0) {
      images = mediaData.images;
    } else if (mediaData.image_post_info?.images) {
      // Fallback: extract from image_post_info structure
      images = mediaData.image_post_info.images
        .map((img) => img.display_image?.url_list?.[0])
        .filter((u): u is string => typeof u === "string");
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images found in this TikTok post. It may be a video, not a photo carousel." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      images,
      title: mediaData.title || "TikTok carousel",
      cover: mediaData.cover || images[0] || "",
      postId: mediaData.id || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
