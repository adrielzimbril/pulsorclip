"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Video, VideoSkin } from "@videojs/react/video";
import "@videojs/react/video/skin.css";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  title?: string;
}

export function VideoPlayerModal({ isOpen, onClose, src, title }: VideoPlayerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            className="relative w-full max-w-5xl overflow-hidden rounded-[32px] border border-line bg-surface shadow-2xl"
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
                className="ml-4 rounded-full bg-background/50 p-2 text-muted transition hover:bg-foreground hover:text-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Player Container */}
            <div className="aspect-video w-full bg-black">
              <Video
                src={`/api/stream?url=${encodeURIComponent(src)}`}
                autoplay
                controls
              >
                <VideoSkin />
              </Video>
            </div>

            {/* Footer / Hint */}
            <div className="bg-surface/50 px-6 py-4 backdrop-blur-sm">
              <p className="text-center text-xs text-muted font-medium uppercase tracking-widest">
                Preview powered by @videojs/react & PulsorClip
              </p>
            </div>

            <style jsx global>{`
              /* Custom styling for Video.js 10/React components */
              .vjs-player {
                width: 100% !important;
                height: 100% !important;
                aspect-ratio: 16 / 9;
              }
              
              /* Glossy/Accent overrides for the new skin */
              .vjs-big-play-button {
                background-color: rgba(124, 58, 237, 0.8) !important;
                border: none !important;
                border-radius: 50% !important;
                width: 80px !important;
                height: 80px !important;
                line-height: 80px !important;
                backdrop-filter: blur(8px);
              }
            `}</style>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
