import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";

export function SiteFooter({ locale }: { locale: AppLocale }) {
  return (
    <footer className="rounded-[28px] border border-line bg-surface px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">{t(locale, "footerCredits")}</p>
          <p className="mt-1 text-sm text-muted">{t(locale, "creatorRole")}</p>
        </div>
        <div className="max-w-3xl text-sm leading-7 text-muted">{t(locale, "footerLegal")}</div>
        <a className="text-sm font-semibold" href="#top">
          {t(locale, "backToTop")}
        </a>
      </div>
    </footer>
  );
}
