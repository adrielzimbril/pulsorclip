"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale, DownloadMode, MediaInfo, AudioContainer, VideoContainer } from "@pulsorclip/core/shared";
import { t } from "@pulsorclip/core/i18n";
import { MediaCard } from "./clip/media-card";
import { SupportedPlatformsModal } from "./clip/supported-platforms-modal";
import type { ClipCard } from "./clip/types";
import { SiteFooter } from "./site/site-footer";
import { SiteHeader } from "./site/site-header";
import { externalLinks } from "@/lib/external-links";

type WorkspaceView = "normal" | "bulk";

function parseUrls(raw: string) {
  const urlPattern = /^https?:\/\//i;
  return [...new Set(raw.split(/[\s,]+/).map((value) => value.trim()).filter((value) => urlPattern.test(value)))];
}

export function ClipWorkbench({
  locale: initialLocale,
  initialUrl = "",
}: {
  locale: AppLocale;
  initialUrl?: string;
}) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("video");
  const [view, setView] = useState<WorkspaceView>("normal");
  const [normalInput, setNormalInput] = useState(initialUrl);
  const [bulkInput, setBulkInput] = useState("");
  const [cards, setCards] = useState<ClipCard[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const intervalsRef = useRef<Map<string, number>>(new Map());
  const alertedErrorsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.cookie = `pulsorclip-locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  useEffect(() => {
    const activeIntervals = intervalsRef.current;
    return () => {
      for (const interval of activeIntervals.values()) {
        window.clearInterval(interval);
      }
    };
  }, []);

  useEffect(() => {
    const nextAlerted = new Set(alertedErrorsRef.current);

    for (const card of cards) {
      if ((card.status === "error" || card.status === "info-error") && card.error && !nextAlerted.has(card.id)) {
        nextAlerted.add(card.id);
        setNotice(card.error);
      }
    }

    alertedErrorsRef.current = nextAlerted;
  }, [cards]);

  const activeInput = view === "normal" ? normalInput : bulkInput;
  const visibleCards = useMemo(() => (view === "normal" ? cards.slice(0, 1) : cards), [cards, view]);
  const canPrepareAll = useMemo(() => visibleCards.some((card) => card.status === "ready"), [visibleCards]);

  function updateCard(id: string, updater: (current: ClipCard) => ClipCard) {
    setCards((current) => current.map((card) => (card.id === id ? updater(card) : card)));
  }

  function openDownload(jobId: string) {
    const anchor = document.createElement("a");
    anchor.href = `/api/file/${jobId}`;
    anchor.download = "";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function inspectUrls(urls: string[]) {
    if (!urls.length) {
      return;
    }

    setIsFetching(true);
    setNotice(t(locale, "inspecting"));

    const initialCards = urls.map<ClipCard>((url, index) => ({
      id: `${Date.now()}-${index}`,
      url,
      title: "",
      thumbnail: "",
      uploader: "",
      duration: null,
      videoOptions: [],
      audioOptions: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
      videoExt: "mp4",
      audioExt: "mp3",
      status: "loading",
      progress: 0,
      progressLabel: null,
    }));

    setCards(initialCards);

    await Promise.all(
      initialCards.map(async (card) => {
        try {
          const response = await fetch("/api/info", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: card.url }),
          });

          const payload = (await response.json()) as Partial<MediaInfo> & { error?: string };

          if (!response.ok || payload.error) {
            updateCard(card.id, (current) => ({
              ...current,
              status: "info-error",
              error: payload.error || "Unable to inspect this URL",
            }));
            return;
          }

          updateCard(card.id, (current) => ({
            ...current,
            status: "ready",
            title: payload.title || "Untitled media",
            thumbnail: payload.thumbnail || "",
            uploader: payload.uploader || "Unknown source",
            duration: payload.duration ?? null,
            videoOptions: payload.videoOptions || [],
            audioOptions: payload.audioOptions || [],
            selectedVideoFormatId: payload.videoOptions?.[0]?.id || null,
            selectedAudioFormatId: payload.audioOptions?.[0]?.id || null,
            videoExt: "mp4",
            audioExt: "mp3",
            progress: 0,
            progressLabel: t(locale, "inspectReady"),
          }));
        } catch (error) {
          updateCard(card.id, (current) => ({
            ...current,
            status: "info-error",
            error: error instanceof Error ? error.message : "Network error",
          }));
        }
      }),
    );

    setNotice(t(locale, "inspectReady"));
    setIsFetching(false);
  }

  async function inspectCurrentInput() {
    const urls = parseUrls(activeInput);
    await inspectUrls(view === "normal" ? urls.slice(0, 1) : urls);
  }

  async function prepareDownload(card: ClipCard) {
    updateCard(card.id, (current) => ({
      ...current,
      status: "queued",
      error: null,
      progress: 0,
      progressLabel: t(locale, "queuedDownload"),
    }));

    const formatId = downloadMode === "video" ? card.selectedVideoFormatId : card.selectedAudioFormatId;
    const targetExt = downloadMode === "video" ? card.videoExt : card.audioExt;

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: card.url,
          mode: downloadMode,
          formatId,
          targetExt,
          title: card.title,
          source: "web",
        }),
      });

      const payload = (await response.json()) as { error?: string; jobId?: string };

      if (!response.ok || !payload.jobId) {
        updateCard(card.id, (current) => ({
          ...current,
          status: "error",
          error: payload.error || "Unable to queue download",
        }));
        return;
      }

      const jobId = payload.jobId;

      updateCard(card.id, (current) => ({
        ...current,
        jobId,
      }));

      const interval = window.setInterval(async () => {
        const statusResponse = await fetch(`/api/status/${jobId}`, { cache: "no-store" });
        const statusPayload = (await statusResponse.json()) as {
          status?: "queued" | "downloading" | "done" | "error";
          progress?: number;
          progressLabel?: string | null;
          queuePosition?: number;
          error?: string | null;
          filename?: string | null;
        };

        if (!statusResponse.ok) {
          window.clearInterval(interval);
          intervalsRef.current.delete(card.id);
          updateCard(card.id, (current) => ({
            ...current,
            status: "error",
            error: statusPayload.error || "Lost track of the job",
            queuePosition: statusPayload.queuePosition ?? current.queuePosition,
          }));
          return;
        }

        if (statusPayload.status === "done") {
          window.clearInterval(interval);
          intervalsRef.current.delete(card.id);
          updateCard(card.id, (current) => ({
            ...current,
            status: "done",
            filename: statusPayload.filename || current.filename,
            progress: statusPayload.progress ?? 100,
            progressLabel: statusPayload.progressLabel || t(locale, "statusReadyMessage"),
            queuePosition: 0,
          }));
          return;
        }

        if (statusPayload.status === "error") {
          window.clearInterval(interval);
          intervalsRef.current.delete(card.id);
          updateCard(card.id, (current) => ({
            ...current,
            status: "error",
            error: statusPayload.error || "Download job failed",
            progress: statusPayload.progress ?? current.progress,
            progressLabel: statusPayload.progressLabel || t(locale, "statusErrorMessage"),
            queuePosition: statusPayload.queuePosition ?? current.queuePosition,
          }));
          return;
        }

        updateCard(card.id, (current) => ({
          ...current,
          status: statusPayload.status === "queued" ? "queued" : "downloading",
          progress: statusPayload.progress ?? current.progress,
          progressLabel: statusPayload.progressLabel || current.progressLabel,
          queuePosition: statusPayload.queuePosition ?? current.queuePosition,
        }));
      }, 1200);

      intervalsRef.current.set(card.id, interval);
    } catch (error) {
      updateCard(card.id, (current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown request error",
      }));
    }
  }

  async function prepareAll() {
    for (const card of visibleCards) {
      if (card.status === "ready") {
        await prepareDownload(card);
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8" id="top">
      <SupportedPlatformsModal locale={locale} onClose={() => setShowPlatforms(false)} open={showPlatforms} />
      <SiteHeader locale={locale} onLocaleChange={setLocale} />

      <section className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:rounded-[32px] sm:p-6" id="workspace">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "workspaceTitle")}</p>
            <h2 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-0.03em]">{t(locale, "workspaceBody")}</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="inline-flex rounded-full border border-line bg-background p-1">
              {(["normal", "bulk"] as const).map((currentView) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${view === currentView ? "bg-foreground text-background" : "text-muted"}`}
                  key={currentView}
                  onClick={() => setView(currentView)}
                  type="button"
                >
                  {currentView === "normal" ? t(locale, "normalMode") : t(locale, "bulkMode")}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-full border border-line bg-background p-1">
              {(["video", "audio"] as const).map((currentMode) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${downloadMode === currentMode ? "bg-foreground text-background" : "text-muted"}`}
                  key={currentMode}
                  onClick={() => setDownloadMode(currentMode)}
                  type="button"
                >
                  {currentMode === "video" ? t(locale, "modeVideo") : t(locale, "modeAudio")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-line bg-background p-5">
            <div className="space-y-2">
              <p className="text-base font-semibold">{view === "normal" ? t(locale, "normalTitle") : t(locale, "bulkTitle")}</p>
              <p className="text-sm leading-7 text-muted">{view === "normal" ? t(locale, "normalBody") : t(locale, "bulkBody")}</p>
            </div>

            <div className="mt-5">
              {view === "normal" ? (
                <input
                  className="h-14 w-full rounded-[18px] border border-line bg-surface px-4 text-sm outline-none transition focus:border-foreground"
                  onChange={(event) => setNormalInput(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={normalInput}
                />
              ) : (
                <textarea
                  className="min-h-48 w-full resize-none rounded-[22px] border border-line bg-surface px-4 py-4 text-sm leading-7 outline-none transition focus:border-foreground"
                  onChange={(event) => setBulkInput(event.target.value)}
                  placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@..."}
                  value={bulkInput}
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isFetching}
                onClick={() => void inspectCurrentInput()}
                type="button"
              >
                {isFetching ? t(locale, "inspecting") : view === "normal" ? t(locale, "inspect") : t(locale, "inspectBulk")}
              </button>
              <button
                className="rounded-full border border-line px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canPrepareAll}
                onClick={() => void prepareAll()}
                type="button"
              >
                {t(locale, "downloadAll")}
              </button>
            </div>

            {notice && (
              <div className="mt-5 rounded-[20px] border border-line bg-surface px-4 py-4 text-sm leading-7 text-muted">
                {notice}
              </div>
            )}

            <div className="mt-5 rounded-[20px] border border-line bg-surface px-4 py-4">
              <p className="text-sm font-semibold">{t(locale, "patienceTitle")}</p>
              <p className="mt-2 text-sm leading-7 text-muted">{t(locale, "patienceBody")}</p>
            </div>

            <div className="mt-5 hidden gap-3 sm:grid-cols-2 lg:grid">
              <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold">{t(locale, "normalStrategyTitle")}</p>
                <p className="mt-2 text-sm leading-7 text-muted">{t(locale, "normalStrategyBody")}</p>
              </div>
              <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold">{t(locale, "bulkStrategyTitle")}</p>
                <p className="mt-2 text-sm leading-7 text-muted">{t(locale, "bulkStrategyBody")}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {visibleCards.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-line bg-background px-6 py-12 text-center text-sm leading-7 text-muted">
                {t(locale, "emptyState")}
              </div>
            ) : null}

            {visibleCards.map((card) => (
              <MediaCard
                card={card}
                key={card.id}
                locale={locale}
                mode={downloadMode}
                onDownload={() => card.jobId && openDownload(card.jobId)}
                onPrepare={() => void prepareDownload(card)}
                onSelectContainer={(container) =>
                  updateCard(card.id, (current) => ({
                    ...current,
                    videoExt: downloadMode === "video" ? (container as VideoContainer) : current.videoExt,
                    audioExt: downloadMode === "audio" ? (container as AudioContainer) : current.audioExt,
                  }))
                }
                onSelectFormat={(formatId) =>
                  updateCard(card.id, (current) => ({
                    ...current,
                    selectedVideoFormatId: downloadMode === "video" ? formatId : current.selectedVideoFormatId,
                    selectedAudioFormatId: downloadMode === "audio" ? formatId : current.selectedAudioFormatId,
                  }))
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:rounded-[28px] sm:p-5" id="overview">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "tagline")}</p>
            <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
              {t(locale, "heroTitle")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {t(locale, "heroBody")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                onClick={() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                type="button"
              >
                {t(locale, "navWorkspace")}
              </button>
              <a
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                href={externalLinks.githubRepo}
                rel="noreferrer"
                target="_blank"
              >
                {t(locale, "forkLabel")}
              </a>
              <a
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                href={externalLinks.telegramBot}
                rel="noreferrer"
                target="_blank"
              >
                {t(locale, "telegramLabel")}
              </a>
            </div>
          </div>

          <div className="rounded-[24px] border border-line bg-background p-5">
            <p className="text-sm font-semibold">{t(locale, "heroStatusTitle")}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{t(locale, "heroStatusBody")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="rounded-full border border-line px-4 py-3 text-sm font-semibold" href="/faq#error-ytdlp-bot-check">
                {t(locale, "heroStatusCta")}
              </Link>
              <button
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                onClick={() => setShowPlatforms(true)}
                type="button"
              >
                {t(locale, "supportedSitesCta")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4" id="platforms">
        <div className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:rounded-[28px] sm:p-5">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "supportSectionTitle")}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{t(locale, "supportSectionBody")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:rounded-[32px] sm:p-6">
          <p className="text-sm font-semibold">{t(locale, "supportedSitesTitle")}</p>
          <p className="mt-3 text-sm leading-7 text-muted">{t(locale, "supportedSitesBody")}</p>
          <button
            className="mt-5 rounded-full border border-line px-4 py-3 text-sm font-semibold"
            onClick={() => setShowPlatforms(true)}
            type="button"
          >
            {t(locale, "supportedSitesCta")}
          </button>
        </div>

        <div className="rounded-[24px] border border-line bg-surface p-4 shadow-sm sm:rounded-[32px] sm:p-6">
          <p className="text-sm font-semibold">{t(locale, "faqCardTitle")}</p>
          <p className="mt-3 text-sm leading-7 text-muted">{t(locale, "faqCardBody")}</p>
          <Link className="mt-5 inline-flex rounded-full border border-line px-4 py-3 text-sm font-semibold" href="/faq">
            {t(locale, "faqCardCta")}
          </Link>
        </div>
        </div>
      </section>

      <SiteFooter locale={locale} />
    </main>
  );
}
