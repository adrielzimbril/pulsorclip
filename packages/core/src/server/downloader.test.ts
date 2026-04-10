import { describe, it, expect, vi } from "vitest";
import { fetchMediaInfo } from "./downloader";
import * as processModule from "./process";

// Mock the runCommand to avoid actually calling yt-dlp during tests
vi.mock("./process", () => ({
  runCommand: vi.fn(),
}));

describe("Downloader Adapter Integration", () => {
  it("should replace twitter.com and x.com URLs with vxtwitter.com to bypass yt-dlp scraping limits", async () => {
    const mockRunCommand = vi.mocked(processModule.runCommand);
    // Mock the dump-single-json successful response
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ title: "Test", formats: [] }),
      stderr: "",
    });

    await fetchMediaInfo("https://x.com/elonmusk/status/123456");

    // The last argument passed to runCommand (which is the yt-dlp process args) should be the rewritten URL
    const callArgs = mockRunCommand.mock.calls[0][1] as string[];
    expect(callArgs.at(-1)).toBe("https://vxtwitter.com/elonmusk/status/123456");
  });

  it("should replace tiktok.com URLs with vxtiktok.com", async () => {
    const mockRunCommand = vi.mocked(processModule.runCommand);
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ title: "Test", formats: [] }),
      stderr: "",
    });

    await fetchMediaInfo("https://vm.tiktok.com/ZMACpSauo/");

    const callArgs = mockRunCommand.mock.calls[1][1] as string[];
    expect(callArgs.at(-1)).toBe("https://vxtiktok.com/ZMACpSauo/");
  });

  it("should replace threads.net URLs with fxthreads.net", async () => {
    const mockRunCommand = vi.mocked(processModule.runCommand);
    mockRunCommand.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ title: "Test", formats: [] }),
      stderr: "",
    });

    await fetchMediaInfo("https://www.threads.com/@user/post/123456");

    const callArgs = mockRunCommand.mock.calls[2][1] as string[];
    expect(callArgs.at(-1)).toBe("https://fxthreads.net/@user/post/123456");
  });
});
