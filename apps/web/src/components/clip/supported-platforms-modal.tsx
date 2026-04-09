"use client";

import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";

const platformGroups = [
  ["YouTube", "YouTube Music", "TikTok", "Instagram", "Facebook", "X / Twitter"],
  ["Vimeo", "Dailymotion", "Twitch", "SoundCloud", "Reddit", "Streamable"],
  ["Loom", "Bilibili", "Pinterest", "VK", "Bandcamp", "Many more via yt-dlp"],
];

export function SupportedPlatformsModal({
  locale,
  open,
  onClose,
}: {
  locale: AppLocale;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl rounded-[28px] border border-line bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "supportedSitesTitle")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{t(locale, "supportedSitesBody")}</h2>
          </div>
          <button className="rounded-full border border-line px-4 py-2 text-sm font-medium" onClick={onClose} type="button">
            {t(locale, "closeModal")}
          </button>
        </div>
        <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
          {platformGroups.map((group, index) => (
            <div className="rounded-[24px] border border-line bg-background p-4" key={index}>
              <ul className="space-y-3 text-sm text-foreground">
                {group.map((platform) => (
                  <li className="rounded-2xl border border-line bg-surface px-3 py-3" key={platform}>
                    {platform}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-6 py-4 text-sm leading-7 text-muted">{t(locale, "supportedSitesFootnote")}</div>
      </div>
    </div>
  );
}
