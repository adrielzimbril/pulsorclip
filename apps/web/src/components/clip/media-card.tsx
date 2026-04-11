"use client";

import Link from "next/link";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale, DownloadMode, AudioContainer, VideoContainer } from "@pulsorclip/core/shared";
import type { ClipCard, CardStatus } from "./types";

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

function explainError(locale: AppLocale, error: string | null | undefined) {
  if (!error) {
    return t(locale, "errorGeneric");
  }

  if (error.includes("authenticated cookies")) {
    return t(locale, "errorYoutubeCookies");
  }

  return error;
}

const funnyStatusLines = {
  en: {
    queued: [
      "🐹 Server hamsters are waiting for a free wheel.",
      "🪑 Queue slot reserved. The pixels are stretching.",
      "🛫 Your clip is parked in the launch lane.",
    ],
    downloading: [
      "📦 Packing pixels and tightening bolts.",
      "☁️ Pulling bytes from the cloud with both hands.",
      "🎛️ Convincing the converter to behave.",
    ],
    finishing: [
      "✨ Dusting the file and checking the corners.",
      "🧼 Adding the final polish before release.",
      "📮 Wrapping the export for delivery.",
    ],
  },
  fr: {
    queued: [
      "🐹 Les hamsters du serveur attendent une roue libre.",
      "🪑 Le slot est réservé. Les pixels s'échauffent.",
      "🛫 Le clip est garé dans la ligne de lancement.",
    ],
    downloading: [
      "📦 On emballe les pixels et on resserre les boulons.",
      "☁️ On tire les octets du cloud à deux mains.",
      "🎛️ On négocie avec le convertisseur pour qu'il reste sage.",
    ],
    finishing: [
      "✨ On dépoussière le fichier avant livraison.",
      "🧼 On ajoute la dernière couche de finition.",
      "📮 L'export est en train d'être emballé.",
    ],
  },
} as const;

function getFunnyStatus(locale: AppLocale, seedSource: string, status: CardStatus, progress: number) {
  const seed = [...seedSource].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  if (status === "queued") {
    const lines = funnyStatusLines[locale].queued;
    return lines[seed % lines.length];
  }

  if (progress >= 90 || status === "done") {
    const lines = funnyStatusLines[locale].finishing;
    return lines[seed % lines.length];
  }

  const lines = funnyStatusLines[locale].downloading;
  return lines[seed % lines.length];
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
  const waitingLine =
    card.progressLabel ||
    (card.status === "done"
      ? t(locale, "statusReadyMessage")
      : getFunnyStatus(locale, card.jobId || card.id, card.status, card.progress));

  return (
    <article className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[16px] border border-line bg-background">
          {card.status === "loading" ? (
            <div className="skeleton h-56 w-full" />
          ) : card.thumbnail && mode === "video" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={card.title || "Media thumbnail"} className="h-56 w-full object-cover" src={card.thumbnail} />
          ) : (
            <div className="flex h-56 items-center justify-center bg-surface-muted text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              {mode === "video" ? t(locale, "modeVideo") : t(locale, "modeAudio")}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-tight tracking-[-0.02em]">
                {card.status === "loading" ? (
                  <div className="skeleton h-7 w-3/4" />
                ) : (
                  card.title || t(locale, "inspecting")
                )}
              </h3>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {card.status === "loading" ? (
                  <>
                    <div className="skeleton h-5 w-24" />
                    <div className="skeleton h-5 w-24" />
                    <div className="skeleton h-5 w-24" />
                  </>
                ) : (
                  <>
                    <span>{t(locale, "sourceLabel")}: {card.uploader || "-"}</span>
                    <span>{t(locale, "durationLabel")}: {formatDuration(card.duration)}</span>
                    <span>{t(locale, "formatLabel")}: {activeContainer.toUpperCase()}</span>
                  </>
                )}
              </div>
            </div>
            <span className="badge">
              {labelForStatus(locale, card.status)}
            </span>
          </div>

          {(card.status === "queued" || card.status === "downloading" || card.status === "done") && (
            <div className="mt-5 rounded-[16px] border border-line bg-surface-muted p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t(locale, "patienceTitle")}</p>
                <span className="text-sm font-medium text-accent">
                  {card.status === "queued" && card.queuePosition
                    ? t(locale, "queuePositionValue").replace("{position}", String(card.queuePosition))
                    : `${card.progress}%`}
                </span>
              </div>
              <div className="h-1 rounded-full bg-line overflow-hidden">
                <div className="progress-bar-accent" style={{ width: `${card.progress}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted">
                {waitingLine}
              </p>
            </div>
          )}

          {/* Quick Preview Player for Direct Audio (Common in TikTok carousels/videos) */}
          {card.resolvedUrl && card.status !== "loading" && (
            <div className="mt-5 overflow-hidden rounded-[20px] border border-line bg-background p-2">
              <audio 
                controls 
                className="h-10 w-full"
                src={`/api/stream?url=${encodeURIComponent(card.resolvedUrl)}`}
              />
            </div>
          )}

          {card.status !== "loading" && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge">
                  {t(locale, "qualityLabel")}
                </span>
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    activeFormatId === null ? "border-accent bg-accent text-background" : "border-line text-muted hover:border-foreground hover:text-foreground"
                  }`}
                  onClick={() => onSelectFormat(null)}
                  type="button"
                >
                  {t(locale, "bestQuality")}
                </button>
                {selectedOptions.slice(0, 8).map((option) => (
                  <button
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      activeFormatId === option.id ? "border-accent bg-accent text-background" : "border-line text-muted hover:border-foreground hover:text-foreground"
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
              <p>{explainError(locale, card.error)}</p>
              <Link className="mt-2 inline-flex text-sm font-semibold underline underline-offset-4" href="/faq#error-ytdlp-bot-check">
                Open FAQ for fixes
              </Link>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              className="btn-accent w-full sm:w-auto"
              disabled={!canPrepare}
              onClick={onPrepare}
              type="button"
            >
              {card.status === "error" ? t(locale, "retry") : card.status === "done" ? t(locale, "statusDone") : t(locale, "prepareDownload")}
            </button>

            <button
              className="btn-outline w-full sm:w-auto"
              disabled={!canDownload && !card.resolvedUrl}
              onClick={() => {
                if (card.resolvedUrl) {
                  // Direct streaming download
                  const filename = `${card.title || "media"}.${mode === "audio" ? "mp3" : "mp4"}`;
                  window.location.href = `/api/stream?url=${encodeURIComponent(card.resolvedUrl)}&download=1&filename=${encodeURIComponent(filename)}`;
                } else if (canDownload) {
                  onDownload();
                }
              }}
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
