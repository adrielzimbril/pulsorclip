import { describe, expect, it } from "vitest";
import { detectLocaleFromHeader, normalizeLocale } from "./translate";

describe("i18n locale helpers", () => {
  it("normalizes known locales", () => {
    expect(normalizeLocale("fr-FR")).toBe("fr");
    expect(normalizeLocale("en-US")).toBe("en");
  });

  it("falls back to english for unknown locales", () => {
    expect(normalizeLocale("es-ES")).toBe("en");
  });

  it("detects locale from accept-language header", () => {
    expect(detectLocaleFromHeader("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(detectLocaleFromHeader("en-US,en;q=0.9")).toBe("en");
  });
});
