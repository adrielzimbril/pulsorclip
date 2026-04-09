"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import type { AppLocale, ThemeMode } from "@pulsorclip/core/shared";
import { t } from "@pulsorclip/core/i18n";

const themeModes: ThemeMode[] = ["light", "dark", "system"];

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
    <div className="inline-flex rounded-full border border-line bg-surface p-1">
      {themeModes.map((mode) => (
        <button
          className={`rounded-full px-3 py-2 text-xs font-medium transition ${
            theme === mode ? "bg-foreground text-background" : "text-muted hover:text-foreground"
          }`}
          key={mode}
          onClick={() => setTheme(mode)}
          type="button"
        >
          {mode === "light" ? t(locale, "themeLight") : mode === "dark" ? t(locale, "themeDark") : t(locale, "themeSystem")}
        </button>
      ))}
    </div>
  );
}
