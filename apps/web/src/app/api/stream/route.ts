import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return new NextResponse(`Remote fetch failed: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }
    
    // Set attachment header if requested
    const download = searchParams.get("download");
    const filename = searchParams.get("filename") || "media";
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }

    // Force browser caching for a short time to improve performance
    headers.set("Cache-Control", "public, max-age=600");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Stream Proxy Error:", error);
    return new NextResponse("Internal Server Error during streaming", { status: 500 });
  }
}
