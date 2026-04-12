import type { AppLocale } from "../shared/types";
import { messages, type MessageKey } from "./messages";

export function normalizeLocale(input: string | null | undefined, fallback: AppLocale = "en"): AppLocale {
  if (!input) {
    return fallback;
  }

  const lowered = input.toLowerCase();

  if (lowered.startsWith("fr")) {
    return "fr";
  }

  if (lowered.startsWith("en")) {
    return "en";
  }

  return fallback;
}

export function detectLocaleFromHeader(headerValue: string | null | undefined, fallback: AppLocale = "en") {
  if (!headerValue) {
    return fallback;
  }

  const first = headerValue.split(",")[0]?.trim();
  return normalizeLocale(first, fallback);
}

export function t(locale: AppLocale, key: MessageKey, params?: Record<string, any>) {
  let message = messages[locale][key] || messages.en[key] || String(key);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{${key}}`, "g"), String(value));
    });
  }

  return message;
}
