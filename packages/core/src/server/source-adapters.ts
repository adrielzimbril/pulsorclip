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
  extractorArgs?: string[];
  note?: string;
};

const SOURCE_ADAPTERS: SourceAdapterRule[] = [
  {
    platform: "tiktok",
    test: (url) => url.includes("tiktok.com/") || url.includes("vt.tiktok.com/"),
    extractorArgs: [
      "--extractor-args",
      "tiktok:api_hostname=api16-normal-useast5.us.tiktokv.com;app_info=7355728856979392262",
    ],
    note: "TikTok uses a tuned extractor profile to improve video and photo-post handling.",
  },
  {
    platform: "threads",
    test: (url) => url.includes("threads.net/") || url.includes("fxthreads.net/"),
  },
  {
    platform: "instagram",
    test: (url) => url.includes("instagram.com/"),
  },
  {
    platform: "facebook",
    test: (url) => url.includes("facebook.com/") || url.includes("fb.watch/"),
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
      "--force-ipv4",
    ],
    note: "YouTube: mweb+ios+tv_embedded player chain with IPv4 enforcement for VPS stability. Add cookies via YTDLP_COOKIES_BASE64 for full access.",
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

  return {
    platform: matched.platform,
    extractorArgs: matched.extractorArgs || [],
    note: matched.note,
  };
}
