import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  const range = request.headers.get("range");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const fetchHeaders = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    });

    if (range) {
      fetchHeaders.set("Range", range);
    }

    const response = await fetch(url, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (!response.ok && response.status !== 206) {
      return new NextResponse(`Remote fetch failed: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentRange = response.headers.get("content-range");
    const contentLength = response.headers.get("content-length");

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");

    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }
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
      status: range && response.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error("Stream Proxy Error:", error);
    return new NextResponse("Internal Server Error during streaming", { status: 500 });
  }
}
