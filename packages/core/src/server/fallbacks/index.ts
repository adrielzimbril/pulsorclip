export { cobaltFallback } from "./cobalt";
export { youtubeFallback } from "./youtube";
export { facebookFallback } from "./facebook";
export { tiktokFallback } from "./tiktok";
export { instagramFallback } from "./instagram";
export { twitterFallback } from "./twitter";
export {
  executeFallbacks,
  detectPlatform,
  type FallbackMediaInfo,
  type FallbackDownloadResult,
  type FallbackHandler,
} from "../fallbacks";

import { cobaltFallback } from "./cobalt";
import { youtubeFallback } from "./youtube";
import { facebookFallback } from "./facebook";
import { tiktokFallback } from "./tiktok";
import { instagramFallback } from "./instagram";
import { twitterFallback } from "./twitter";

/**
 * All available fallback handlers
 */
export const allFallbacks = [
  cobaltFallback,
  youtubeFallback,
  facebookFallback,
  tiktokFallback,
  instagramFallback,
  twitterFallback,
];
