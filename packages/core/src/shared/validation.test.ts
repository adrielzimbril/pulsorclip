import { describe, expect, it } from "vitest";
import { downloadRequestSchema } from "./validation";

describe("download request validation", () => {
  it("accepts mkv as a target extension", () => {
    const payload = downloadRequestSchema.parse({
      url: "https://example.com/video",
      mode: "video",
      targetExt: "mkv",
    });

    expect(payload.targetExt).toBe("mkv");
  });

  it("accepts audio payloads", () => {
    const payload = downloadRequestSchema.parse({
      url: "https://example.com/audio",
      mode: "audio",
      targetExt: "mp3",
    });

    expect(payload.mode).toBe("audio");
  });
});
