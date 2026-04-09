"use client";

import Link from "next/link";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ locale, onLocaleChange }: { locale: AppLocale; onLocaleChange?: (locale: AppLocale) => void }) {
  function handleLocaleChange(nextLocale: AppLocale) {
    if (onLocaleChange) {
      onLocaleChange(nextLocale);
      return;
    }

    document.cookie = `pulsorclip-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <header className="sticky top-4 z-40 rounded-[24px] border border-line bg-surface/95 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <Link className="flex items-center gap-3" href="/">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background">P</div>
          <div>
            <p className="text-base font-semibold">{t(locale, "appName")}</p>
            <p className="text-sm text-muted">{t(locale, "creatorLine")}</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-background p-1 text-sm">
          <Link className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground" href="/">
            {t(locale, "navOverview")}
          </Link>
          <Link className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground" href="/#workspace">
            {t(locale, "navWorkspace")}
          </Link>
          <Link className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground" href="/faq">
            FAQ
          </Link>
          <Link className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground" href="/docs">
            Docs
          </Link>
          <Link className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground" href="/deployment">
            {t(locale, "navDeployment")}
          </Link>
        </nav>

        <div className="flex flex-wrap gap-3">
          <LocaleSwitcher locale={locale} onChange={handleLocaleChange} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  );
}
