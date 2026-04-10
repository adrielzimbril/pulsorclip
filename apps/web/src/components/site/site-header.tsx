"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { externalLinks } from "@/lib/external-links";

export function SiteHeader({
  locale,
  onLocaleChange,
}: {
  locale: AppLocale;
  onLocaleChange?: (locale: AppLocale) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLocaleChange(nextLocale: AppLocale) {
    if (onLocaleChange) {
      onLocaleChange(nextLocale);
      return;
    }

    document.cookie = `pulsorclip-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <header className="sticky top-2 z-40 rounded-[20px] border border-line bg-surface/95 px-3 py-3 shadow-sm backdrop-blur sm:top-3 sm:rounded-[24px] sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-4">
        <Link
          className="flex items-center gap-3"
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-background">
            <Image
              alt="PulsorClip logo"
              height={36}
              priority
              src="/icon.png"
              width={36}
            />
          </div>
          <p className="text-base font-semibold">{t(locale, "appName")}</p>
        </Link>

        <button
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-background px-4 text-sm font-semibold lg:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          {t(locale, "menuLabel")}
        </button>
      </div>

      <div
        className={`${menuOpen ? "mt-4 flex" : "hidden"} flex-col gap-4 lg:mt-4 lg:flex lg:flex-row lg:items-center lg:justify-between`}
      >
        <nav className="flex flex-col gap-2 rounded-[20px] border border-line bg-background p-2 text-sm lg:flex-row lg:flex-wrap lg:items-center lg:gap-2 lg:rounded-full lg:p-1">
          <Link
            className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground"
            href="/faq"
            onClick={() => setMenuOpen(false)}
          >
            {t(locale, "navFaq")}
          </Link>
          <a
            className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground"
            href={externalLinks.githubRepo}
            rel="noreferrer"
            target="_blank"
          >
            {t(locale, "navGithub")}
          </a>
          <a
            className="rounded-full px-4 py-2 text-muted transition hover:bg-surface hover:text-foreground"
            href={externalLinks.telegramBot}
            rel="noreferrer"
            target="_blank"
          >
            {t(locale, "navTelegram")}
          </a>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LocaleSwitcher locale={locale} onChange={handleLocaleChange} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  );
}
