import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function encodeCookiesToBase64(cookiesPath: string) {
  try {
    const absolutePath = resolve(cookiesPath);
    const cookiesContent = readFileSync(absolutePath, "utf-8");
    const base64Encoded = Buffer.from(cookiesContent).toString("base64");

    console.log("✅ Cookies encoded successfully!");
    console.log("\n" + "=".repeat(60));
    console.log("Add this to your environment variables:");
    console.log("=".repeat(60));
    console.log(`\nYTDLP_COOKIES_BASE64=${base64Encoded}`);
    console.log("\n" + "=".repeat(60));
    console.log("\nFor Railway/Render, paste the base64 value in the dashboard.");
    console.log("For local .env, paste the entire line above.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Failed to encode cookies:", message);
    console.error("\nMake sure:");
    console.error("1. The cookies.txt file exists");
    console.error("2. You have the correct path");
    console.error("3. The file is readable");
    process.exit(1);
  }
}

// Get cookies file path from command line argument or use default
const cookiesPath = process.argv[2] || "./cookies.txt";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: npm run encode-cookies [path-to-cookies.txt]");
  console.log("\nExample:");
  console.log("  npm run encode-cookies ./cookies.txt");
  console.log("  npm run encode-cookies /path/to/your/cookies.txt");
  console.log("\nThis script will encode your cookies.txt file to base64");
  console.log("so you can use it with YTDLP_COOKIES_BASE64 environment variable.");
  process.exit(0);
}

void encodeCookiesToBase64(cookiesPath);
