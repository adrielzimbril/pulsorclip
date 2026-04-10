import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import { externalLinks } from "@/lib/external-links";

export function SiteFooter({ locale }: { locale: AppLocale }) {
  return (
    <footer className="rounded-[24px] border border-line bg-surface px-4 py-5 shadow-sm sm:rounded-[28px] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold">{t(locale, "footerCredits")}</p>
          <p className="mt-1 text-sm text-muted">{t(locale, "creatorRole")}</p>
        </div>
        <div className="max-w-3xl text-sm leading-7 text-muted">{t(locale, "footerLegal")}</div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <a className="rounded-full border border-line px-4 py-2 text-sm font-semibold" href={externalLinks.githubRepo} rel="noreferrer" target="_blank">
              {t(locale, "forkLabel")}
            </a>
            <a className="rounded-full border border-line px-4 py-2 text-sm font-semibold" href={externalLinks.telegramBot} rel="noreferrer" target="_blank">
              {t(locale, "telegramLabel")}
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="text-sm text-muted underline underline-offset-4" href={externalLinks.githubProfile} rel="noreferrer" target="_blank">
              {t(locale, "githubLabel")}
            </a>
            <a className="text-sm text-muted underline underline-offset-4" href={externalLinks.website} rel="noreferrer" target="_blank">
              {t(locale, "websiteLabel")}
            </a>
            <a className="text-sm font-semibold" href="#top">
              {t(locale, "backToTop")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
