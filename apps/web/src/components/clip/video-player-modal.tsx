"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useRef, useEffect, useState } from "react";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  title?: string;
  resolvedVideoUrl?: string;
  platform?: string;
  sourceUrl?: string;
}

export function VideoPlayerModal({
  isOpen,
  onClose,
  src,
  title,
  resolvedVideoUrl,
  platform,
  sourceUrl,
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string>("");

  useEffect(() => {
    // Check if it's a YouTube video
    const isYoutube =
      platform === "youtube" ||
      src.includes("youtube.com") ||
      src.includes("youtu.be") ||
      sourceUrl?.includes("youtube.com") ||
      sourceUrl?.includes("youtu.be") ||
      (resolvedVideoUrl &&
        (resolvedVideoUrl.includes("youtube.com") ||
          resolvedVideoUrl.includes("youtu.be"))) ||
      false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsYouTube(isYoutube);

    if (isYoutube) {
      // Extract YouTube video ID for embed
      const urlToUse = sourceUrl || resolvedVideoUrl || src;
      const videoIdMatch = urlToUse.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      );
      if (videoIdMatch) {
        const embedUrl = `https://www.youtube.com/embed/${videoIdMatch[1]}`;
        setYoutubeEmbedUrl(embedUrl);
        console.log("YouTube embed URL:", embedUrl);
      }
    }
  }, [src, resolvedVideoUrl, platform, sourceUrl]);

  useEffect(() => {
    if (isOpen && videoRef.current && !isYouTube) {
      videoRef.current.play().catch(() => {
        // Auto-play might be blocked by browser
      });
    }
  }, [isOpen, isYouTube]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl max-h-[95dvh] overflow-hidden rounded-[32px] border border-line bg-surface shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line bg-surface/50 px-6 py-4 backdrop-blur-sm">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-semibold tracking-tight">
                  {title || "Video Preview"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="ml-4 rounded-full bg-background/50 p-2 text-muted cursor-pointer transition hover:bg-foreground hover:text-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Container */}
            <div className="flex! relative! aspect-video w-full h-full max-h-[84dvh] bg-black">
              {isYouTube ? (
                <iframe
                  src={youtubeEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={`/api/stream?url=${encodeURIComponent(src)}`}
                  controls
                  loop
                  preload="auto"
                  className="w-full h-full max-h-[84dvh] object-contain"
                  playsInline
                  translate="yes"
                />
              )}
            </div>

            {/* Footer / Hint */}
            <div className="bg-surface/50 px-6 py-4 backdrop-blur-sm">
              <p className="text-center text-xs text-muted font-medium uppercase tracking-widest">
                Preview powered by PulsorClip
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
