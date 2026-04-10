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
      "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com;app_info=7355728856979392262",
    ],
    note: "TikTok uses a tuned extractor profile to improve video and photo-post handling.",
  },
  {
    platform: "threads",
    test: (url) => url.includes("threads.net/"),
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
  },
  {
    platform: "youtube",
    test: (url) => url.includes("youtube.com/") || url.includes("youtu.be/") || url.includes("music.youtube.com/"),
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
