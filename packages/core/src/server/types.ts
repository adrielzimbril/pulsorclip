export type MediaMode = "video" | "audio";

export type MediaFormat = {
  id: string;
  label: string;
  height: number;
};

export type MediaInfo = {
  title: string;
  thumbnail: string;
  duration: number | null;
  uploader: string;
  formats: MediaFormat[];
};

export type JobStatus = "queued" | "downloading" | "done" | "error";

export type DownloadJob = {
  id: string;
  url: string;
  mode: MediaMode;
  formatId: string | null;
  title: string;
  status: JobStatus;
  error?: string;
  filePath?: string;
  filename?: string;
  createdAt: number;
  updatedAt: number;
  resolvedUrl?: string;
  resolvedVideoUrl?: string;
};
