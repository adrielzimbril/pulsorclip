import { cookies, headers } from "next/headers";
import { detectLocaleFromHeader, normalizeLocale } from "@pulsorclip/core/i18n";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get("pulsorclip-locale")?.value;

  return cookieLocale
    ? normalizeLocale(cookieLocale)
    : detectLocaleFromHeader(headerStore.get("accept-language"));
}
