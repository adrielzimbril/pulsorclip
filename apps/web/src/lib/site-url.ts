const fallbackUrl = "https://example.com";

export function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return fallbackUrl;
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return fallbackUrl;
  }
}
