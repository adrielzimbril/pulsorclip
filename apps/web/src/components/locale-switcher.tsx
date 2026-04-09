"use client";

import type { AppLocale } from "@pulsorclip/core/shared";
import { t } from "@pulsorclip/core/i18n";

export function LocaleSwitcher({
  locale,
  onChange,
}: {
  locale: AppLocale;
  onChange: (locale: AppLocale) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm text-muted">
      <span className="sr-only">Language</span>
      <select
        className="bg-transparent outline-none"
        onChange={(event) => onChange(event.target.value as AppLocale)}
        value={locale}
      >
        <option value="en">{t("en", "localeEnglish")}</option>
        <option value="fr">{t("fr", "localeFrench")}</option>
      </select>
    </label>
  );
}
