"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppLocale,
  DownloadMode,
  MediaInfo,
  AudioContainer,
  VideoContainer,
  PlaylistEntry,
} from "@pulsorclip/core/shared";
import { t } from "@pulsorclip/core/i18n";
import { MediaCard } from "./clip/media-card";
import { SupportedPlatformsModal } from "./clip/supported-platforms-modal";
import type { ClipCard } from "./clip/types";
import { SiteHeader } from "./site/site-header";
import { VideoPlayerModal } from "./clip/video-player-modal";
import { externalLinks } from "@/lib/external-links";

type WorkspaceView = "normal" | "bulk";
type PlaylistModalState = {
  title: string;
  count: number;
  entries: PlaylistEntry[];
};
type QueueJob = {
  id: string;
  title: string;
  url: string;
  mode: DownloadMode;
  status: "queued" | "downloading" | "done" | "error";
  progress: number;
  progressLabel: string | null;
  queuePosition: number;
  error: string | null;
  filename: string | null;
  createdAt: number;
};

function parseUrls(raw: string) {
  const urlPattern = /^https?:\/\//i;
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter((value) => urlPattern.test(value)),
    ),
  ];
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
  const [tiktokCarousel, setTiktokCarousel] = useState<{
    images: string[];
    title: string;
    postId: string;
    audioUrl?: string;
  } | null>(null);
  const [playlistModal, setPlaylistModal] = useState<PlaylistModalState | null>(
    null,
  );
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedPlaylistEntries, setSelectedPlaylistEntries] = useState<
    Set<string>
  >(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [isQueueingPlaylist, setIsQueueingPlaylist] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [serverQueue, setServerQueue] = useState<QueueJob[]>([]);
  const [previewVideo, setPreviewVideo] = useState<{
    src: string;
    title: string;
    resolvedVideoUrl?: string;
    platform?: string;
    sourceUrl?: string;
  } | null>(null);
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
    let alive = true;

    const refreshQueue = async () => {
      try {
        const response = await fetch("/api/queue", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { jobs?: QueueJob[] };
        if (alive) {
          setServerQueue(payload.jobs || []);
        }
      } catch {
        // Keep the last known queue state.
      }
    };

    void refreshQueue();
    const interval = window.setInterval(() => {
      void refreshQueue();
    }, 2500);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const nextAlerted = new Set(alertedErrorsRef.current);

    for (const card of cards) {
      if (
        (card.status === "error" || card.status === "info-error") &&
        card.error &&
        !nextAlerted.has(card.id)
      ) {
        nextAlerted.add(card.id);
        setNotice(card.error);
      }
    }

    alertedErrorsRef.current = nextAlerted;
  }, [cards]);

  const activeInput = view === "normal" ? normalInput : bulkInput;
  const visibleCards = useMemo(
    () => (view === "normal" ? cards.slice(0, 1) : cards),
    [cards, view],
  );
  const canPrepareAll = useMemo(
    () => visibleCards.some((card) => card.status === "ready"),
    [visibleCards],
  );
  const queueSummary = useMemo(
    () => ({
      queued: serverQueue.filter((job) => job.status === "queued").length,
      downloading: serverQueue.filter((job) => job.status === "downloading")
        .length,
      done: serverQueue.filter((job) => job.status === "done").length,
      error: serverQueue.filter((job) => job.status === "error").length,
    }),
    [serverQueue],
  );

  function updateCard(id: string, updater: (current: ClipCard) => ClipCard) {
    setCards((current) =>
      current.map((card) => (card.id === id ? updater(card) : card)),
    );
  }

  async function cancelQueuedJob(jobId: string) {
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cancel", jobId }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error || t(locale, "queueCancelFailed"));
        return;
      }

      setNotice(t(locale, "cancelledQueueItem"));
      setServerQueue((current) =>
        current.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: "error",
                error: "Cancelled by user before processing started.",
                progressLabel: "Cancelled",
                queuePosition: 0,
              }
            : job,
        ),
      );
    } catch {
      setNotice(t(locale, "networkError"));
    }
  }

  function clearLocalCards(status: "done" | "error") {
    setCards((current) => current.filter((card) => card.status !== status));
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
    setNotice(t(locale, "detectingCarouselTikTok"));
    try {
      const res = await fetch("/api/tiktok-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        images?: string[];
        title?: string;
        postId?: string;
        audioUrl?: string;
        error?: string;
      };
      if (!res.ok || data.error || !data.images?.length) {
        setNotice(data.error || t(locale, "carouselError"));
        return;
      }
      setTiktokCarousel({
        images: data.images,
        title: data.title || t(locale, "imageGallery"),
        postId: data.postId || "",
        audioUrl: data.audioUrl,
      });
      setSelectedImages(new Set(data.images));
      setNotice(null);
    } catch {
      setNotice(t(locale, "networkError"));
    }
  }

  async function downloadCarouselZip() {
    if (!tiktokCarousel || selectedImages.size === 0) return;
    setIsZipping(true);
    setNotice(t(locale, "generatingZip"));
    try {
      const res = await fetch("/api/tiktok-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: [...selectedImages],
          title: tiktokCarousel.title,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setNotice(err.error || t(locale, "networkError"));
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
      setNotice(`${selectedImages.size} ${t(locale, "zipReady")}`);
    } catch {
      setNotice(t(locale, "networkError"));
    } finally {
      setIsZipping(false);
    }
  }

  function downloadSingleImage(url: string, index: number) {
    const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[0] ?? ".jpg";
    const a = document.createElement("a");
    a.href = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    a.download = `image-${String(index + 1).padStart(3, "0")}${ext}`;
    a.target = "_blank";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAllDirectly() {
    if (!tiktokCarousel || selectedImages.size === 0) return;
    const imagesToDownload = tiktokCarousel.images.filter((img) =>
      selectedImages.has(img),
    );

    imagesToDownload.forEach((url, i) => {
      setTimeout(() => {
        downloadSingleImage(url, i);
      }, i * 300); // Stagger to avoid browser blocks
    });
    setNotice(`${imagesToDownload.length} ${t(locale, "zipReady")}`);
  }

  function buildPlaylistCards(entries: PlaylistEntry[]): ClipCard[] {
    return entries.map((entry, index) => ({
      id: `playlist-${Date.now()}-${index}`,
      url: entry.url,
      title: entry.title,
      thumbnail: entry.thumbnail || "",
      uploader: entry.uploader || "YouTube",
      duration: entry.duration ?? null,
      videoOptions: [],
      audioOptions: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
      videoExt: "mp4",
      audioExt: "mp3",
      status: "ready",
      progress: 0,
      progressLabel: t(locale, "inspectReady"),
    }));
  }

  async function queuePlaylistSelection(mode: DownloadMode) {
    if (!playlistModal || selectedPlaylistEntries.size === 0) {
      return;
    }

    const selectedEntries = playlistModal.entries.filter((entry) =>
      selectedPlaylistEntries.has(entry.url),
    );
    const playlistCards = buildPlaylistCards(selectedEntries);

    setIsQueueingPlaylist(true);
    setView("bulk");
    setNotice(t(locale, "queueingSelection"));
    setCards((current) => [...playlistCards, ...current]);
    setPlaylistModal(null);

    try {
      if (downloadMode !== mode) {
        setDownloadMode(mode);
      }

      for (const card of playlistCards) {
        await prepareDownload(
          {
            ...card,
            videoExt: mode === "video" ? "mp4" : card.videoExt,
            audioExt: mode === "audio" ? "mp3" : card.audioExt,
          },
          mode,
        );
      }

      setNotice(
        t(locale, "playlistQueued").replace(
          "{count}",
          String(selectedEntries.length),
        ),
      );
    } finally {
      setIsQueueingPlaylist(false);
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

          const payload = (await response.json()) as Partial<MediaInfo> & {
            error?: string;
          };

          // Generic image gallery: if /api/info returns images[], open carousel modal
          // BUT: for Threads, we prioritize the regular workbench if video is present
          const isThreads =
            card.url.includes("threads.net") ||
            card.url.includes("threads.com");
          const hasVideo =
            payload.videoOptions && payload.videoOptions.length > 0;

          if (
            response.ok &&
            payload.playlist?.entries &&
            payload.playlist.entries.length > 0
          ) {
            setCards([]);
            setIsFetching(false);
            setPlaylistModal({
              title:
                payload.playlist.title ||
                payload.title ||
                t(locale, "playlistTitle"),
              count: payload.playlist.count || payload.playlist.entries.length,
              entries: payload.playlist.entries,
            });
            setSelectedPlaylistEntries(
              new Set(payload.playlist.entries.map((entry) => entry.url)),
            );
            setNotice(t(locale, "playlistDetected"));
            return;
          }

          if (
            response.ok &&
            payload.images &&
            payload.images.length > 0 &&
            (!isThreads || !hasVideo)
          ) {
            setCards([]);
            setIsFetching(false);
            setTiktokCarousel({
              images: payload.images,
              title: payload.title || "Image gallery",
              postId: payload.postId || "",
              audioUrl: payload.resolvedUrl ?? undefined,
            });
            return;
          }

          // TikTok carousel fallback: when yt-dlp returns Unsupported URL, try our scraper
          if (
            (!response.ok || payload.error === "Unsupported URL") &&
            isTikTokUrl(card.url)
          ) {
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
            resolvedUrl: payload.resolvedUrl,
            resolvedVideoUrl: payload.resolvedVideoUrl ?? payload.resolvedUrl,
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

  async function prepareDownload(card: ClipCard, modeOverride?: DownloadMode) {
    const activeMode = modeOverride || downloadMode;

    updateCard(card.id, (current) => ({
      ...current,
      status: "queued",
      error: null,
      progress: 0,
      progressLabel: t(locale, "queuedDownload"),
    }));

    const formatId =
      activeMode === "video"
        ? card.selectedVideoFormatId
        : card.selectedAudioFormatId;
    const targetExt = activeMode === "video" ? card.videoExt : card.audioExt;
    const directUrl =
      activeMode === "video"
        ? card.resolvedVideoUrl || null
        : card.resolvedUrl || null;

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: card.url,
          mode: activeMode,
          formatId,
          targetExt,
          title: card.title,
          source: "web",
          resolvedUrl: directUrl,
          resolvedVideoUrl: card.resolvedVideoUrl || null,
          thumbnail: card.thumbnail,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        jobId?: string;
      };

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
        const statusResponse = await fetch(`/api/status/${jobId}`, {
          cache: "no-store",
        });
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
            progressLabel:
              statusPayload.progressLabel || t(locale, "statusReadyMessage"),
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
            progressLabel:
              statusPayload.progressLabel || t(locale, "statusErrorMessage"),
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
    <main
      className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8"
      id="top"
    >
      <SupportedPlatformsModal
        locale={locale}
        onClose={() => setShowPlatforms(false)}
        open={showPlatforms}
      />
      <SiteHeader locale={locale} onLocaleChange={setLocale} />

      <VideoPlayerModal
        isOpen={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        src={previewVideo?.src || ""}
        title={previewVideo?.title}
        resolvedVideoUrl={previewVideo?.resolvedVideoUrl}
        platform={previewVideo?.platform}
        sourceUrl={previewVideo?.sourceUrl}
      />

      <section
        className="rounded-[20px] border border-line bg-surface p-3 sm:rounded-[32px] sm:p-6"
        id="workspace"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              {t(locale, "workspaceTitle")}
            </p>
            <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {t(locale, "workspaceBody")}
            </h2>
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
                  {currentView === "normal"
                    ? t(locale, "normalMode")
                    : t(locale, "bulkMode")}
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
                  {currentMode === "video"
                    ? t(locale, "modeVideo")
                    : t(locale, "modeAudio")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="rounded-[22px] border border-line bg-background p-4 sm:rounded-[28px] sm:p-5">
            <div className="space-y-2">
              <p className="text-base font-semibold">
                {view === "normal"
                  ? t(locale, "normalTitle")
                  : t(locale, "bulkTitle")}
              </p>
              <p className="text-sm leading-7 text-muted">
                {view === "normal"
                  ? t(locale, "normalBody")
                  : t(locale, "bulkBody")}
              </p>
            </div>

            <div className="mt-5">
              {view === "normal" ? (
                <div className="relative">
                  <input
                    className="input-field pr-28"
                    onChange={(event) => setNormalInput(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isFetching)
                        void inspectCurrentInput();
                    }}
                    placeholder="https://youtube.com/watch?v=... or TikTok, X, Threads..."
                    value={normalInput}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setNormalInput(text);
                      } catch {
                        /* clipboard permission denied */
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
                    title="Paste from clipboard"
                    aria-label="Paste from clipboard"
                  >
                    {t(locale, "pasteFromClipboard")}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    className="min-h-48 w-full resize-none rounded-[18px] border border-line bg-surface px-4 py-4 pr-24 text-sm leading-7 outline-none transition focus:border-foreground"
                    onChange={(event) => setBulkInput(event.target.value)}
                    placeholder={
                      "https://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@..."
                    }
                    value={bulkInput}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text)
                          setBulkInput((prev) =>
                            prev ? `${prev}\n${text}` : text,
                          );
                      } catch {
                        /* clipboard permission denied */
                      }
                    }}
                    className="absolute right-3 top-3 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                    title={t(locale, "pasteFromClipboard")}
                    aria-label={t(locale, "pasteFromClipboard")}
                  >
                    {t(locale, "pasteFromClipboard")}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                className="btn-accent w-full sm:w-auto"
                disabled={isFetching || !activeInput.trim()}
                onClick={() => void inspectCurrentInput()}
                type="button"
              >
                {isFetching
                  ? t(locale, "inspecting")
                  : view === "normal"
                    ? t(locale, "inspect")
                    : t(locale, "inspectBulk")}
              </button>
              <button
                className="btn-outline w-full sm:w-auto"
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
              <p className="text-sm font-semibold">
                {t(locale, "patienceTitle")}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                {t(locale, "patienceBody")}
              </p>
            </div>

            <div className="mt-5 rounded-[20px] border border-line bg-surface px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {t(locale, "webQueueTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t(locale, "webQueueSummary")
                      .replace("{queued}", String(queueSummary.queued))
                      .replace(
                        "{downloading}",
                        String(queueSummary.downloading),
                      )
                      .replace("{done}", String(queueSummary.done))
                      .replace("{error}", String(queueSummary.error))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => clearLocalCards("done")}
                    type="button"
                  >
                    {t(locale, "clearReadyCards")}
                  </button>
                  <button
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => clearLocalCards("error")}
                    type="button"
                  >
                    {t(locale, "clearFailedCards")}
                  </button>
                </div>
              </div>

              {serverQueue.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {serverQueue.slice(0, 8).map((job) => (
                    <div
                      className="rounded-[16px] border border-line bg-background px-3 py-3"
                      key={job.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {job.title || `Job ${job.id}`}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {job.mode.toUpperCase()} · {job.status}
                            {job.status === "queued" && job.queuePosition
                              ? ` · #${job.queuePosition}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            className="btn-outline px-3 py-2 text-xs"
                            href={`/track/${job.id}`}
                          >
                            {t(locale, "botOpenWeb")}
                          </a>
                          {job.status === "done" ? (
                            <a
                              className="btn-outline px-3 py-2 text-xs"
                              href={`/api/file/${job.id}`}
                            >
                              {t(locale, "download")}
                            </a>
                          ) : null}
                          {job.status === "queued" ? (
                            <button
                              className="btn-outline px-3 py-2 text-xs"
                              onClick={() => void cancelQueuedJob(job.id)}
                              type="button"
                            >
                              {t(locale, "cancelQueueItem")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs text-muted">
                        {job.url}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {job.error || job.progressLabel || `${job.progress}%`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  {t(locale, "noWebQueueJobs")}
                </p>
              )}
            </div>

            <div className="mt-5 hidden gap-3 sm:grid-cols-2 lg:grid">
              <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold">
                  {t(locale, "normalStrategyTitle")}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {t(locale, "normalStrategyBody")}
                </p>
              </div>
              <div className="rounded-[20px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold">
                  {t(locale, "bulkStrategyTitle")}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {t(locale, "bulkStrategyBody")}
                </p>
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
                onPreview={(
                  src,
                  title,
                  resolvedVideoUrl,
                  platform,
                  sourceUrl,
                ) =>
                  setPreviewVideo({
                    src,
                    title,
                    resolvedVideoUrl,
                    platform,
                    sourceUrl,
                  })
                }
                onSelectContainer={(container) =>
                  updateCard(card.id, (current) => ({
                    ...current,
                    videoExt:
                      downloadMode === "video"
                        ? (container as VideoContainer)
                        : current.videoExt,
                    audioExt:
                      downloadMode === "audio"
                        ? (container as AudioContainer)
                        : current.audioExt,
                  }))
                }
                onSelectFormat={(formatId) =>
                  updateCard(card.id, (current) => ({
                    ...current,
                    selectedVideoFormatId:
                      downloadMode === "video"
                        ? formatId
                        : current.selectedVideoFormatId,
                    selectedAudioFormatId:
                      downloadMode === "audio"
                        ? formatId
                        : current.selectedAudioFormatId,
                  }))
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="rounded-[20px] border border-line bg-surface p-3 sm:rounded-[28px] sm:p-5"
        id="overview"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              {t(locale, "tagline")}
            </p>
            <h1 className="mt-3 max-w-4xl text-xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
              {t(locale, "heroTitle")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              {t(locale, "heroBody")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                onClick={() =>
                  document
                    .getElementById("workspace")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
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
            <p className="text-sm font-semibold">
              {t(locale, "heroStatusTitle")}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted">
              {t(locale, "heroStatusBody")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold"
                href="/faq#error-ytdlp-bot-check"
              >
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
        <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
            {t(locale, "supportSectionTitle")}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            {t(locale, "supportSectionBody")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[32px] sm:p-6">
            <p className="text-sm font-semibold">
              {t(locale, "supportedSitesTitle")}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted">
              {t(locale, "supportedSitesBody")}
            </p>
            <button
              className="mt-5 rounded-full border border-line px-4 py-3 text-sm font-semibold"
              onClick={() => setShowPlatforms(true)}
              type="button"
            >
              {t(locale, "supportedSitesCta")}
            </button>
          </div>

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:rounded-[32px] sm:p-6">
            <p className="text-sm font-semibold">{t(locale, "faqCardTitle")}</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              {t(locale, "faqCardBody")}
            </p>
            <Link
              className="mt-5 inline-flex rounded-full border border-line px-4 py-3 text-sm font-semibold"
              href="/faq"
            >
              {t(locale, "faqCardCta")}
            </Link>
          </div>
        </div>
      </section>

      {playlistModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "playlistTitle")}
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isQueueingPlaylist) {
              setPlaylistModal(null);
            }
          }}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[28px] border border-line bg-surface">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-line bg-surface p-6 pb-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                  {t(locale, "playlistTitle")}
                </p>
                <h2 className="mt-1 truncate text-base font-bold">
                  {playlistModal.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {selectedPlaylistEntries.size} /{" "}
                  {playlistModal.entries.length} {t(locale, "itemsSelected")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t(locale, "closeModal")}
                disabled={isQueueingPlaylist}
                onClick={() => setPlaylistModal(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-foreground hover:text-foreground disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="space-y-3">
                {playlistModal.entries.map((entry, index) => {
                  const isSelected = selectedPlaylistEntries.has(entry.url);
                  return (
                    <button
                      key={`${entry.id}-${index}`}
                      type="button"
                      onClick={() =>
                        setSelectedPlaylistEntries((prev) => {
                          const next = new Set(prev);
                          if (next.has(entry.url)) next.delete(entry.url);
                          else next.add(entry.url);
                          return next;
                        })
                      }
                      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-foreground bg-background"
                          : "border-line bg-background/50 hover:border-foreground/50"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted text-xs font-bold">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      {entry.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.thumbnail}
                          alt=""
                          className="h-16 w-28 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-muted text-[11px] font-semibold uppercase text-muted">
                          YouTube
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold">
                          {entry.title}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {[
                            entry.uploader,
                            entry.duration
                              ? `${Math.floor(entry.duration / 60)}:${String(entry.duration % 60).padStart(2, "0")}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${isSelected ? "border-foreground bg-foreground text-background" : "border-line text-muted"}`}
                      >
                        {isSelected ? "✓" : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-line bg-surface p-6 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPlaylistEntries(
                        new Set(
                          playlistModal.entries.map((entry) => entry.url),
                        ),
                      )
                    }
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {t(locale, "selectAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlaylistEntries(new Set())}
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {t(locale, "deselectAll")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      selectedPlaylistEntries.size === 0 || isQueueingPlaylist
                    }
                    onClick={() => void queuePlaylistSelection("audio")}
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {t(locale, "queueSelectedAudio")} (
                    {selectedPlaylistEntries.size})
                  </button>
                  <button
                    type="button"
                    disabled={
                      selectedPlaylistEntries.size === 0 || isQueueingPlaylist
                    }
                    onClick={() => void queuePlaylistSelection("video")}
                    className="btn-primary px-4 py-2 text-xs"
                  >
                    {t(locale, "queueSelectedVideo")} (
                    {selectedPlaylistEntries.size})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Carousel Modal */}
      {tiktokCarousel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "imageGallery")}
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDownloadDropdown(false);
              setTiktokCarousel(null);
            }
          }}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[28px] border border-line bg-surface">
            {/* Header — Sticky */}
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-line bg-surface p-6 pb-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                  {t(locale, "imageGallery")}
                </p>
                <h2 className="mt-1 truncate text-base font-bold">
                  {tiktokCarousel.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {selectedImages.size} / {tiktokCarousel.images.length}{" "}
                  {selectedImages.size <= 1
                    ? t(locale, "imageSelected")
                    : t(locale, "imagesSelected")}{" "}
                  — {t(locale, "clickToToggle")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t(locale, "closeModal")}
                onClick={() => {
                  setShowDownloadDropdown(false);
                  setTiktokCarousel(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Image grid */}
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {tiktokCarousel.images.map((imgUrl, index) => {
                  const isSelected = selectedImages.has(imgUrl);
                  return (
                    <div key={imgUrl} className="group relative">
                      <button
                        type="button"
                        aria-label={`Image ${index + 1}${isSelected ? " (selected)" : ""}`}
                        onClick={() => {
                          setSelectedImages((prev) => {
                            const next = new Set(prev);
                            if (next.has(imgUrl)) next.delete(imgUrl);
                            else next.add(imgUrl);
                            return next;
                          });
                        }}
                        className="relative w-full overflow-hidden rounded-xl bg-surface-muted transition"
                        style={{
                          border: isSelected
                            ? "3px solid var(--foreground)"
                            : "3px solid transparent",
                          aspectRatio: "9/16",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={`Image ${index + 1}`}
                          className={`h-full w-full object-cover transition-opacity ${isSelected ? "opacity-70" : "opacity-100"}`}
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                              ✓
                            </span>
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadSingleImage(imgUrl, index)}
                        className="absolute bottom-2 left-2 right-2 rounded-lg border border-line bg-background/90 px-2 py-1.5 text-center text-[0.68rem] font-bold text-foreground backdrop-blur-sm transition opacity-0 group-hover:opacity-100"
                      >
                        {t(locale, "downloadImage")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions — Sticky Footer */}
            <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-line bg-surface p-6 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImages(new Set(tiktokCarousel.images))
                    }
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {t(locale, "selectAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImages(new Set())}
                    className="btn-outline px-4 py-2 text-xs"
                  >
                    {t(locale, "deselectAll")}
                  </button>
                </div>

                <div className="relative flex gap-2">
                  {tiktokCarousel.audioUrl && (
                    <a
                      href={`/api/stream?url=${encodeURIComponent(tiktokCarousel.audioUrl)}&download=1&filename=tiktok-audio.mp3`}
                      className="btn-outline px-4 py-2 text-xs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t(locale, "botAudioLabel")}
                    </a>
                  )}

                  <div className="flex">
                    <button
                      type="button"
                      disabled={selectedImages.size === 0 || isZipping}
                      onClick={() => downloadAllDirectly()}
                      className="btn-primary flex items-center gap-0 rounded-r-none border-r-0 pr-3"
                    >
                      {t(locale, "downloadAllDirect")} ({selectedImages.size})
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        disabled={selectedImages.size === 0 || isZipping}
                        onClick={() =>
                          setShowDownloadDropdown(!showDownloadDropdown)
                        }
                        className="btn-primary h-full rounded-l-none border-l border-l-white/20 px-2 flex items-center justify-center transition hover:bg-primary-hover"
                        aria-label="Download options"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${showDownloadDropdown ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {showDownloadDropdown && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-black/10">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDownloadDropdown(false);
                              void downloadCarouselZip();
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-surface-muted transition"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                              />
                            </svg>
                            {t(locale, "downloadAsZipOption")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDownloadDropdown(false);
                              downloadAllDirectly();
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-surface-muted transition"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3"
                              />
                            </svg>
                            {t(locale, "downloadAllDirect")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
