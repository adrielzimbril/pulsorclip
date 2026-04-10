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
  const [tiktokCarousel, setTiktokCarousel] = useState<{ images: string[]; title: string; postId: string } | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
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

  function isTikTokUrl(url: string) {
    return /tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(url);
  }

  async function fetchTikTokCarousel(url: string) {
    setNotice("🎞️ Détection de diaporama TikTok...");
    try {
      const res = await fetch("/api/tiktok-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { images?: string[]; title?: string; postId?: string; error?: string };
      if (!res.ok || data.error || !data.images?.length) {
        setNotice(data.error || "Impossible d'extraire les images de ce diaporama TikTok.");
        return;
      }
      setTiktokCarousel({ images: data.images, title: data.title || "TikTok carousel", postId: data.postId || "" });
      setSelectedImages(new Set(data.images));
      setNotice(null);
    } catch {
      setNotice("Erreur réseau lors de l'extraction du diaporama TikTok.");
    }
  }

  async function downloadCarouselZip() {
    if (!tiktokCarousel || selectedImages.size === 0) return;
    setIsZipping(true);
    setNotice("📦 Génération du ZIP en cours...");
    try {
      const res = await fetch("/api/tiktok-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: [...selectedImages], title: tiktokCarousel.title }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setNotice(err.error || "Erreur lors de la génération du ZIP.");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${tiktokCarousel.title.slice(0, 64)}.zip`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setNotice(`✅ ${selectedImages.size} image(s) téléchargée(s) avec succès.`);
    } catch {
      setNotice("Erreur réseau lors du téléchargement du ZIP.");
    } finally {
      setIsZipping(false);
    }
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

          // TikTok carousel detection: if yt-dlp returns Unsupported URL on a TikTok link,
          // switch to the carousel scraper instead
          if ((!response.ok || payload.error === "Unsupported URL") && isTikTokUrl(card.url)) {
            setCards([]);
            setIsFetching(false);
            void fetchTikTokCarousel(card.url);
            return;
          }

          if (!response.ok || payload.error) {
            updateCard(card.id, (current) => ({
              ...current,
              status: "info-error",
              error: payload.error || "Unable to load this URL",
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

      <section className="rounded-[20px] border border-line bg-surface p-3 shadow-sm sm:rounded-[32px] sm:p-6" id="workspace">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "workspaceTitle")}</p>
            <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{t(locale, "workspaceBody")}</h2>
          </div>

          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <div className="grid grid-cols-2 rounded-[18px] border border-line bg-background p-1 sm:inline-flex sm:rounded-full">
              {(["normal", "bulk"] as const).map((currentView) => (
                <button
                  className={`rounded-[14px] px-4 py-2 text-sm font-semibold sm:rounded-full ${view === currentView ? "bg-foreground text-background" : "text-muted"}`}
                  key={currentView}
                  onClick={() => setView(currentView)}
                  type="button"
                >
                  {currentView === "normal" ? t(locale, "normalMode") : t(locale, "bulkMode")}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 rounded-[18px] border border-line bg-background p-1 sm:inline-flex sm:rounded-full">
              {(["video", "audio"] as const).map((currentMode) => (
                <button
                  className={`rounded-[14px] px-4 py-2 text-sm font-semibold sm:rounded-full ${downloadMode === currentMode ? "bg-foreground text-background" : "text-muted"}`}
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
          <div className="rounded-[22px] border border-line bg-background p-4 sm:rounded-[28px] sm:p-5">
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                disabled={isFetching}
                onClick={() => void inspectCurrentInput()}
                type="button"
              >
                {isFetching ? t(locale, "inspecting") : view === "normal" ? t(locale, "inspect") : t(locale, "inspectBulk")}
              </button>
              <button
                className="w-full rounded-full border border-line px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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

      <section className="rounded-[20px] border border-line bg-surface p-3 shadow-sm sm:rounded-[28px] sm:p-5" id="overview">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">{t(locale, "tagline")}</p>
            <h1 className="mt-3 max-w-4xl text-xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
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

      {/* TikTok Carousel Modal — additive overlay, does not touch existing JSX grid */}
      {tiktokCarousel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sélection du diaporama TikTok"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setTiktokCarousel(null); }}
        >
          <div
            style={{
              background: "var(--color-surface, #fff)",
              border: "1px solid var(--color-line, #e5e7eb)",
              borderRadius: "24px",
              padding: "1.5rem",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.5 }}>Diaporama TikTok</p>
                <h2 style={{ marginTop: "0.25rem", fontSize: "1rem", fontWeight: 700, maxWidth: "480px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tiktokCarousel.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setTiktokCarousel(null)}
                style={{ background: "none", border: "1px solid var(--color-line, #e5e7eb)", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
              {selectedImages.size} / {tiktokCarousel.images.length} image(s) sélectionnée(s) — cliquez pour (dé)sélectionner
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
              {tiktokCarousel.images.map((imgUrl, index) => {
                const isSelected = selectedImages.has(imgUrl);
                return (
                  <button
                    key={imgUrl}
                    type="button"
                    aria-label={`Image ${index + 1}${isSelected ? " (sélectionnée)" : ""}`}
                    onClick={() => {
                      setSelectedImages((prev) => {
                        const next = new Set(prev);
                        if (next.has(imgUrl)) next.delete(imgUrl);
                        else next.add(imgUrl);
                        return next;
                      });
                    }}
                    style={{
                      padding: 0,
                      border: isSelected ? "3px solid var(--color-foreground, #111)" : "3px solid transparent",
                      borderRadius: "12px",
                      cursor: "pointer",
                      overflow: "hidden",
                      position: "relative",
                      background: "none",
                      aspectRatio: "9/16",
                      outline: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`Image ${index + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                    {isSelected && (
                      <span
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          background: "var(--color-foreground, #111)",
                          color: "var(--color-background, #fff)",
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <button
                type="button"
                disabled={selectedImages.size === 0 || isZipping}
                onClick={() => void downloadCarouselZip()}
                style={{
                  borderRadius: "999px",
                  background: "var(--color-foreground, #111)",
                  color: "var(--color-background, #fff)",
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: selectedImages.size === 0 || isZipping ? "not-allowed" : "pointer",
                  opacity: selectedImages.size === 0 || isZipping ? 0.5 : 1,
                }}
              >
                {isZipping ? "📦 Génération..." : `⬇️ Télécharger ${selectedImages.size} image(s) en ZIP`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedImages(new Set(tiktokCarousel.images))}
                style={{
                  borderRadius: "999px",
                  border: "1px solid var(--color-line, #e5e7eb)",
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "none",
                  cursor: "pointer",
                }}
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={() => setSelectedImages(new Set())}
                style={{
                  borderRadius: "999px",
                  border: "1px solid var(--color-line, #e5e7eb)",
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "none",
                  cursor: "pointer",
                }}
              >
                Tout désélectionner
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
