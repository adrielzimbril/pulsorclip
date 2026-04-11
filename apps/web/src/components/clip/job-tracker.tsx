"use client";

import { useEffect, useState } from "react";
import { ProgressBar } from "./progress-bar";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import { Check, Loader2, AlertCircle, Download } from "lucide-react";

interface JobStatus {
  status: string;
  progress: number;
  progressLabel: string | null;
  queuePosition: number;
  error: string | null;
  filename: string | null;
  title?: string;
  platform?: string;
}

export function JobTracker({ jobId, locale }: { jobId: string; locale: AppLocale }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: any;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError(locale === "fr" ? "Travail introuvable ou expiré" : "Job not found or expired");
          } else {
            setError(locale === "fr" ? "Erreur de chargement" : "Error loading status");
          }
          return;
        }

        const data = await res.json();
        setJob(data);
        setLoading(false);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to fetch job status", err);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId, locale]);

  if (loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-foreground/50" />
        <p className="text-muted-foreground">{t(locale, "botProcessing")}</p>
      </div>
    );
  }

  if (error || (job && job.status === "failed")) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 rounded-[32px] border border-line bg-background/50 py-16 text-center shadow-xl backdrop-blur-sm">
        <div className="rounded-full bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold">{locale === "fr" ? "Échec de l'export" : "Export Failed"}</h2>
        <p className="max-w-md text-muted-foreground px-6">{error || job?.error || (locale === "fr" ? "Une erreur inconnue est survenue" : "An unknown error occurred")}</p>
        <button 
          onClick={() => window.location.href = "/"}
          className="mt-4 flex items-center space-x-2 rounded-full bg-foreground px-8 py-3 font-medium text-background transition-transform active:scale-95"
        >
          <span>{locale === "fr" ? "Retour à l'accueil" : "Back to Home"}</span>
        </button>
      </div>
    );
  }

  if (!job) return null;

  const isCompleted = job.status === "completed";
  const isQueued = job.status === "queued";

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[40px] border border-line bg-background shadow-2xl">
      {/* Header */}
      <div className="border-b border-line p-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isCompleted ? 'bg-green-500/10 text-green-500' : 'bg-foreground/10 text-foreground'}`}>
                {isCompleted ? <Check className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
             </div>
             <div>
                <h1 className="text-xl font-bold line-clamp-1">{job.title || (locale === "fr" ? "Traitement du média" : "Processing Media")}</h1>
                <p className="text-sm text-muted-foreground">ID: {jobId}</p>
             </div>
          </div>
          <div className="rounded-full bg-surface-muted px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
             {job.status}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 pt-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{isCompleted ? (locale === "fr" ? "Prêt pour le téléchargement" : "Ready for download") : (isQueued ? (locale === "fr" ? `En file d'attente (Position: ${job.queuePosition})` : `In Queue (Position: ${job.queuePosition})`) : t(locale, "botProcessing"))}</span>
            <span className="text-foreground">{Math.round(job.progress)}%</span>
          </div>
          <ProgressBar value={job.progress} />
          {job.progressLabel && (
            <p className="text-center text-xs font-mono text-muted-foreground">{job.progressLabel}</p>
          )}
        </div>

        {isCompleted && job.filename && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex flex-col space-y-3">
              <a
                href={`/api/file/${jobId}`}
                download
                className="flex w-full items-center justify-center space-x-3 rounded-[24px] bg-foreground py-5 text-lg font-bold text-background shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Download className="h-6 w-6" />
                <span>{locale === "fr" ? "Télécharger le fichier" : "Download File"}</span>
              </a>
              <p className="text-center text-sm text-muted-foreground">
                {job.filename}
              </p>
            </div>
          </div>
        )}

        {!isCompleted && !isQueued && (
            <div className="flex justify-center">
                <p className="text-sm text-muted-foreground italic">
                    {locale === "fr" ? "Veuillez ne pas quitter cette page..." : "Please keep this page open..."}
                </p>
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-surface-muted/30 p-8 text-center border-t border-line">
         <p className="text-sm text-muted-foreground">
            {locale === "fr" 
                ? "Vous pouvez aussi retrouver ce fichier sur le Bot Telegram" 
                : "You can also find this file on the Telegram Bot"}
         </p>
      </div>
    </div>
  );
}
