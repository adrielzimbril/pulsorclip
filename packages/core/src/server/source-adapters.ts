type SourcePlatform =
  | "youtube"
  | "instagram"
  | "facebook"
  | "threads"
  | "x"
  | "tiktok"
  | "generic";

type SourceProfile = {
  platform: SourcePlatform;
  extractorArgs: string[];
  note?: string;
};

type SourceAdapterRule = {
  platform: SourcePlatform;
  test: (normalizedUrl: string) => boolean;
  extractorArgs?: string[] | ((url: string) => string[]);
  note?: string;
};

const SOURCE_ADAPTERS: SourceAdapterRule[] = [
  {
    platform: "tiktok",
    test: (url) => url.includes("tiktok.com/") || url.includes("vt.tiktok.com/"),
    extractorArgs: [
      "--extractor-args",
      "tiktok:app_info=7355728856979392262",
      "--referer",
      "https://www.tiktok.com/",
    ],
    note: "TikTok: Simplified extractor profile with Referer spoofing for better resilience on datacenter IPs.",
  },
  {
    platform: "threads",
    test: (url) => url.includes("threads.net/"),
  },
  {
    platform: "instagram",
    test: (url) => url.includes("instagram.com/"),
    extractorArgs: (url) =>
      url.includes("/stories/")
        ? ["--referer", "https://www.instagram.com/stories/"]
        : [],
  },
  {
    platform: "facebook",
    test: (url) =>
      url.includes("facebook.com/") ||
      url.includes("fb.watch/") ||
      url.includes("facebook.com/share/s/"),
    extractorArgs: (url) =>
      url.includes("/stories/") || url.includes("/share/s/")
        ? ["--referer", "https://www.facebook.com/"]
        : [],
  },
  {
    platform: "x",
    test: (url) => url.includes("x.com/") || url.includes("twitter.com/"),
    extractorArgs: [
      "--extractor-args",
      "twitter:api=syndication",
    ],
  },
  {
    platform: "youtube",
    test: (url) => url.includes("youtube.com/") || url.includes("youtu.be/") || url.includes("music.youtube.com/"),
    extractorArgs: [
      "--extractor-args",
      // Use mweb+ios+tv_embedded as a fallback chain — avoids bot-detection on VPS
      // mweb is the most resilient on headless servers without cookies
      "youtube:player_client=mweb,ios,tv_embedded",
      "--age-limit",
      "100",
      "--extractor-retries",
      "3",
    ],
    note: "YouTube: mweb+ios+tv_embedded player chain with global IPv4 enforcement for VPS stability.",
  },
];

export function getSourceProfile(url: string): SourceProfile {
  const normalizedUrl = url.trim().toLowerCase();
  const matched = SOURCE_ADAPTERS.find((rule) => rule.test(normalizedUrl));

  if (!matched) {
    return {
      platform: "generic",
      extractorArgs: [],
    };
  }

  let extractorArgs: string[] = [];
  if (matched.extractorArgs) {
    extractorArgs = typeof matched.extractorArgs === "function" 
      ? matched.extractorArgs(normalizedUrl) 
      : matched.extractorArgs;
  }

  return {
    platform: matched.platform,
    extractorArgs,
    note: matched.note,
  };
}
