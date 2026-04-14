import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logServer } from "@pulsorclip/core/server";

function encodeCookiesToBase64(cookiesPath: string, outputPath?: string) {
  try {
    const absolutePath = resolve(cookiesPath);
    const cookiesContent = readFileSync(absolutePath, "utf-8");
    const base64Encoded = Buffer.from(cookiesContent).toString("base64");

    logServer("info", "cookies.encode.success", {
      path: absolutePath,
      length: cookiesContent.length,
    });

    const envVar = `YTDLP_COOKIES_BASE64=${base64Encoded}`;

    if (outputPath) {
      const outputAbsPath = resolve(outputPath);
      writeFileSync(outputAbsPath, base64Encoded, "utf-8");
      logServer("info", "cookies.encode.saved", {
        outputPath: outputAbsPath,
      });
    } else {
      logServer("info", "cookies.encode.output", {
        message: "Add this to your environment variables:",
        envVar,
        instructions:
          "For Railway/Render, paste the base64 value in the dashboard. For local .env, paste the entire line above.",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logServer("error", "cookies.encode.failed", {
      reason: message,
      path: cookiesPath,
    });
    process.exit(1);
  }
}

// Get cookies file path from command line argument or use default
const cookiesPath = process.argv[2] || "./cookies.txt";
const outputPath = process.argv[3];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  logServer("info", "cookies.encode.help", {
    usage: "npm run encode-cookies [path-to-cookies.txt] [output-file.txt]",
    examples: [
      "npm run encode-cookies ./cookies.txt",
      "npm run encode-cookies ./cookies.txt ./cookies-base64.txt",
      "npm run encode-cookies /path/to/your/cookies.txt /path/to/output.txt",
    ],
    description:
      "This script will encode your cookies.txt file to base64 so you can use it with YTDLP_COOKIES_BASE64 environment variable. Optionally saves to a file.",
  });
  process.exit(0);
}

void encodeCookiesToBase64(cookiesPath, outputPath);
