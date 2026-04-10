"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import type { AppLocale } from "@pulsorclip/core/shared";
import { t } from "@pulsorclip/core/i18n";

export function ThemeToggle({ locale }: { locale: AppLocale }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (theme) {
      document.cookie = `pulsorclip-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [theme]);

  if (!mounted) {
    return <div className="inline-flex h-[42px] rounded-full border border-line bg-surface px-3 py-2" />;
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm text-muted">
      <span className="sr-only">{t(locale, "themeLabel")}</span>
      <select
        aria-label={t(locale, "themeLabel")}
        className="bg-transparent outline-none"
        onChange={(event) => setTheme(event.target.value)}
        value={theme || "system"}
      >
        <option value="light">{t(locale, "themeLight")}</option>
        <option value="dark">{t(locale, "themeDark")}</option>
        <option value="system">{t(locale, "themeSystem")}</option>
      </select>
    </label>
  );
}
