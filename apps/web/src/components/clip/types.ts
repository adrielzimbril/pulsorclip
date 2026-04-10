import type { AudioContainer, MediaOption, VideoContainer } from "@pulsorclip/core/shared";

export type CardStatus = "loading" | "ready" | "queued" | "downloading" | "done" | "info-error" | "error";

export type ClipCard = {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  uploader: string;
  duration: number | null;
  videoOptions: MediaOption[];
  audioOptions: MediaOption[];
  selectedVideoFormatId: string | null;
  selectedAudioFormatId: string | null;
  videoExt: VideoContainer;
  audioExt: AudioContainer;
  filename?: string | null;
  error?: string | null;
  jobId?: string;
  status: CardStatus;
  progress: number;
  progressLabel?: string | null;
  queuePosition?: number;
  resolvedUrl?: string;
};
