"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { externalLinks } from "@/lib/external-links";

interface JobStatus {
  status: "queued" | "downloading" | "done" | "error";
  progress: number;
  progressLabel: string | null;
  queuePosition: number;
  error: string | null;
  filename: string | null;
  title?: string;
  platform?: string;
  thumbnail?: string | null;
  url?: string | null;
  resolvedVideoUrl?: string | null;
}

const funnyWaitingLines = {
  en: [
    "📦 Packing pixels for the last mile.",
    "🎛️ The converter is arguing with the bitrate.",
    "✨ Final checks in progress before release.",
  ],
  fr: [
    "📦 On emballe les pixels pour le dernier kilomètre.",
    "🎛️ Le convertisseur discute avec le bitrate.",
    "✨ Dernières vérifications avant livraison.",
  ],
} as const;

function getFunnyWaiting(locale: AppLocale, seedSource: string) {
  const lines = funnyWaitingLines[locale];
  const seed = [...seedSource].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return lines[seed % lines.length];
}

export function JobTracker({
  jobId,
  locale,
}: {
  jobId: string;
  locale: AppLocale;
}) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { isYouTube, youtubeEmbedUrl } = useMemo(() => {
    if (!job?.resolvedVideoUrl) {
      return { isYouTube: false, youtubeEmbedUrl: "" };
    }

    const isYoutube =
      job.resolvedVideoUrl.includes("youtube.com/watch") ||
      job.resolvedVideoUrl.includes("youtu.be") ||
      (job.url &&
        (job.url.includes("youtube.com/watch") ||
          job.url.includes("youtu.be"))) ||
      false;

    if (isYoutube) {
      const urlToUse = job.resolvedVideoUrl || job.url;
      const videoIdMatch = urlToUse?.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      );
      if (videoIdMatch) {
        return {
          isYouTube: true,
          youtubeEmbedUrl: `https://www.youtube.com/embed/${videoIdMatch[1]}`,
        };
      }
    }

    return { isYouTube: false, youtubeEmbedUrl: "" };
  }, [job]);

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`, { cache: "no-store" });

        if (!res.ok) {
          if (!active) return;
          setError(
            res.status === 404
              ? t(locale, "trackJobMissing")
              : t(locale, "trackLoadingError"),
          );
          setLoading(false);
          return;
        }

        const data = (await res.json()) as JobStatus;
        if (!active) return;

        setJob(data);
        setLoading(false);

        if (data.status === "done" || data.status === "error") {
          window.clearInterval(interval);
        }
      } catch {
        if (!active) return;
        setError(t(locale, "trackLoadingError"));
        setLoading(false);
      }
    };

    void fetchStatus();
    const interval = window.setInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [jobId, locale]);

  if (loading && !error) {
    return (
      <section className="rounded-[24px] border border-line bg-surface p-8 text-center sm:rounded-[32px] sm:p-12">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              {t(locale, "trackTitle")}
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {t(locale, "botProcessing")}
            </h1>
            <p className="text-sm leading-7 text-muted">
              {t(locale, "trackBody")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error || (job && job.status === "error")) {
    return (
      <section className="rounded-[24px] border border-red-200 bg-surface p-6 sm:rounded-[32px] sm:p-8 dark:border-red-950/50">
        <div className="grid gap-6 lg:grid-cols-[96px_minmax(0,1fr)] lg:items-start">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              {t(locale, "trackTitle")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              {t(locale, "trackExportFailed")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              {error || job?.error || t(locale, "trackUnknownError")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-accent" href="/">
                <span className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {t(locale, "trackReloadLink")}
                </span>
              </Link>
              <a
                className="btn-outline"
                href={externalLinks.telegramBot}
                rel="noreferrer"
                target="_blank"
              >
                <span className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t(locale, "trackBackToBot")}
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!job) return null;

  const isCompleted = job.status === "done";
  const isQueued = job.status === "queued";
  const headline = isCompleted
    ? t(locale, "trackStatusDone")
    : isQueued
      ? t(locale, "trackStatusQueued")
      : t(locale, "trackStatusProgress");
  const detail = isCompleted
    ? t(locale, "statusReadyMessage")
    : isQueued
      ? t(locale, "queuePositionValue").replace(
          "{position}",
          String(job.queuePosition || 1),
        )
      : job.progressLabel || getFunnyWaiting(locale, jobId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
      <article className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[32px] sm:p-6">
        <div className="overflow-hidden rounded-[20px] border border-line bg-background">
          {job.resolvedVideoUrl ? (
            <div className="relative aspect-video">
              {isYouTube ? (
                <iframe
                  src={youtubeEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={`/api/stream?url=${encodeURIComponent(job.resolvedVideoUrl)}`}
                  autoPlay
                  controls
                  loop
                  aria-disabled
                  preload="auto"
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture={true}
                  disableRemotePlayback={true}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-full object-contain"
                  playsInline
                />
              )}
            </div>
          ) : job.thumbnail ? (
            <div className="relative aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25 blur-2xl scale-105"
                src={job.thumbnail}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={job.title || "Preview"}
                className="relative h-full w-full object-contain"
                src={job.thumbnail}
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-surface-muted">
              {isCompleted ? (
                <Check className="h-12 w-12 text-green-600" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-foreground" />
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              {t(locale, "trackTitle")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {job.title || t(locale, "botProcessing")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              {t(locale, "trackBody")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {job.platform ? (
              <span className="badge">{job.platform}</span>
            ) : null}
            <span className="badge">{headline}</span>
          </div>
        </div>

        <div className="mt-6 rounded-[20px] border border-line bg-background p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {headline}
              </p>
              <p className="mt-2 text-sm font-semibold">{detail}</p>
            </div>
            <p className="text-3xl font-semibold tracking-[-0.04em]">
              {Math.round(job.progress)}%
            </p>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full transition-all duration-500 ${isCompleted ? "bg-green-600" : "bg-foreground"}`}
              style={{ width: `${job.progress}%` }}
            />
          </div>

          {!isCompleted && !isQueued ? (
            <p className="mt-4 text-sm text-muted">
              {getFunnyWaiting(locale, jobId)}
            </p>
          ) : null}
        </div>

        {isCompleted && job.filename ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="btn-accent" download href={`/api/file/${jobId}`}>
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                {t(locale, "trackDownloadCta")}
              </span>
            </a>
            <Link className="btn-outline" href="/">
              {t(locale, "trackReloadLink")}
            </Link>
          </div>
        ) : null}
      </article>

      <aside className="space-y-4">
        <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-sm font-semibold">
            {t(locale, "trackJobIdLabel")}
          </p>
          <p className="mt-2 break-all font-mono text-sm text-muted">{jobId}</p>
        </div>

        {job.url ? (
          <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-sm font-semibold">Source URL</p>
            <p className="mt-2 break-all font-mono text-sm text-muted">
              {job.url}
            </p>
            <a
              href={job.url}
              rel="noreferrer"
              target="_blank"
              className="mt-2 btn-outline text-foreground hover:underline"
            >
              {t(locale, "openInWeb")}
            </a>
          </div>
        ) : null}

        <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-sm font-semibold">{t(locale, "patienceTitle")}</p>
          <p className="mt-2 text-sm leading-7 text-muted">{detail}</p>
        </div>

        <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-sm font-semibold">{t(locale, "trackBackToBot")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="btn-outline"
              href={externalLinks.telegramBot}
              rel="noreferrer"
              target="_blank"
            >
              <span className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {t(locale, "trackBackToBot")}
              </span>
            </a>
          </div>
        </div>
      </aside>
    </section>
  );
}
