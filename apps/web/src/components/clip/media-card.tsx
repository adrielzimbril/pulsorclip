"use client";

import Link from "next/link";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale, DownloadMode, AudioContainer, VideoContainer } from "@pulsorclip/core/shared";
import type { ClipCard, CardStatus } from "./types";
import { ProgressBar } from "./progress-bar";

function formatDuration(value: number | null) {
  if (!value) {
    return "Live";
  }

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function labelForStatus(locale: AppLocale, status: CardStatus) {
  if (status === "ready") return t(locale, "statusReady");
  if (status === "loading") return t(locale, "statusLoading");
  if (status === "queued") return t(locale, "statusQueued");
  if (status === "downloading") return t(locale, "statusDownloading");
  if (status === "done") return t(locale, "statusDone");
  return t(locale, "statusError");
}

function explainError(error: string | null | undefined) {
  if (!error) {
    return "Request failed";
  }

  if (error.includes("authenticated cookies")) {
    return "YouTube requires cookies for this media. Configure YTDLP_COOKIES_FROM_BROWSER, YTDLP_COOKIES_FILE, or YTDLP_COOKIES_BASE64.";
  }

  return error;
}

export function MediaCard({
  locale,
  card,
  mode,
  onPrepare,
  onDownload,
  onSelectFormat,
  onSelectContainer,
}: {
  locale: AppLocale;
  card: ClipCard;
  mode: DownloadMode;
  onPrepare: () => void;
  onDownload: () => void;
  onSelectFormat: (formatId: string | null) => void;
  onSelectContainer: (container: VideoContainer | AudioContainer) => void;
}) {
  const selectedOptions = mode === "video" ? card.videoOptions : card.audioOptions;
  const activeFormatId = mode === "video" ? card.selectedVideoFormatId : card.selectedAudioFormatId;
  const activeContainer = mode === "video" ? card.videoExt : card.audioExt;
  const canPrepare = card.status === "ready" || card.status === "error";
  const canDownload = card.status === "done" && !!card.jobId;

  return (
    <article className="rounded-[28px] border border-line bg-surface p-5 shadow-sm">
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[24px] border border-line bg-background">
          {card.status === "loading" ? (
            <div className="h-56 animate-pulse bg-surface-muted" />
          ) : card.thumbnail && mode === "video" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={card.title || "Media thumbnail"} className="h-56 w-full object-cover" src={card.thumbnail} />
          ) : (
            <div className="flex h-56 items-center justify-center bg-surface-muted text-base font-semibold tracking-[0.18em] text-muted">
              {mode === "video" ? "VIDEO" : "AUDIO"}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-2xl font-semibold leading-tight tracking-[-0.03em]">
                {card.title || t(locale, "inspecting")}
              </h3>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <span>{t(locale, "sourceLabel")}: {card.uploader || "-"}</span>
                <span>{t(locale, "durationLabel")}: {formatDuration(card.duration)}</span>
                <span>{t(locale, "formatLabel")}: {activeContainer.toUpperCase()}</span>
              </div>
            </div>
            <div className="rounded-full border border-line bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {labelForStatus(locale, card.status)}
            </div>
          </div>

          {(card.status === "queued" || card.status === "downloading" || card.status === "done") && (
            <div className="mt-5 rounded-[22px] border border-line bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t(locale, "patienceTitle")}</p>
                <span className="text-sm text-muted">
                  {card.status === "queued" && card.queuePosition
                    ? t(locale, "queuePositionValue").replace("{position}", String(card.queuePosition))
                    : `${card.progress}%`}
                </span>
              </div>
              <ProgressBar value={card.progress} />
              <p className="mt-3 text-sm text-muted">
                {card.progressLabel || (card.status === "done" ? t(locale, "statusReadyMessage") : t(locale, "statusWaiting"))}
              </p>
            </div>
          )}

          {card.status !== "loading" && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-line bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {t(locale, "qualityLabel")}
                </span>
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-medium ${
                    activeFormatId === null ? "border-foreground bg-foreground text-background" : "border-line text-muted"
                  }`}
                  onClick={() => onSelectFormat(null)}
                  type="button"
                >
                  {t(locale, "bestQuality")}
                </button>
                {selectedOptions.slice(0, 8).map((option) => (
                  <button
                    className={`rounded-full border px-3 py-2 text-xs font-medium ${
                      activeFormatId === option.id ? "border-foreground bg-foreground text-background" : "border-line text-muted"
                    }`}
                    key={option.id}
                    onClick={() => onSelectFormat(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">{t(locale, mode === "video" ? "videoContainer" : "audioContainer")}</span>
                <select
                  className="rounded-full border border-line bg-background px-4 py-3 text-sm"
                  onChange={(event) => onSelectContainer(event.target.value as VideoContainer | AudioContainer)}
                  value={activeContainer}
                >
                  {mode === "video" ? (
                    <>
                      <option value="mp4">MP4</option>
                      <option value="webm">WEBM</option>
                      <option value="mkv">MKV</option>
                    </>
                  ) : (
                    <>
                      <option value="mp3">MP3</option>
                      <option value="m4a">M4A</option>
                    </>
                  )}
                </select>
              </div>
            </>
          )}

          {(card.status === "info-error" || card.status === "error") && (
            <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-danger dark:border-red-950/50 dark:bg-red-950/30">
              <p>{explainError(card.error)}</p>
              <Link className="mt-2 inline-flex text-sm font-semibold underline underline-offset-4" href="/faq#error-ytdlp-bot-check">
                Open FAQ for fixes
              </Link>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canPrepare}
              onClick={onPrepare}
              type="button"
            >
              {card.status === "error" ? t(locale, "retry") : card.status === "done" ? t(locale, "statusDone") : t(locale, "prepareDownload")}
            </button>

            <button
              className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canDownload}
              onClick={onDownload}
              type="button"
            >
              {t(locale, "download")}
            </button>
          </div>

          <p className="mt-3 text-sm leading-7 text-muted">
            {canDownload ? t(locale, "manualDownloadHint") : t(locale, "patienceBody")}
          </p>
        </div>
      </div>
    </article>
  );
}
