"use client";

import { useEffect, useState } from "react";
import { t } from "@pulsorclip/core/i18n";
import type { AppLocale } from "@pulsorclip/core/shared";
import { Check, Loader2, AlertCircle, Download, ArrowLeft, ExternalLink } from "lucide-react";
import { externalLinks } from "@/lib/external-links";

interface JobStatus {
  status: string;
  progress: number;
  progressLabel: string | null;
  queuePosition: number;
  error: string | null;
  filename: string | null;
  title?: string;
  platform?: string;
  thumbnail?: string | null;
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
  const seed = [...seedSource].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[seed % lines.length];
}

export function JobTracker({ jobId, locale }: { jobId: string; locale: AppLocale }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        if (data.status === "done" || data.status === "error") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to fetch job status", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId, locale]);

  if (loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-32 text-center animate-pulse">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" />
          <Loader2 className="relative h-16 w-16 animate-spin text-primary" />
        </div>
        <p className="text-xl font-medium text-muted-foreground">{t(locale, "botProcessing")}</p>
      </div>
    );
  }

  if (error || (job && job.status === "error")) {
    return (
      <div className="mx-auto max-w-lg overflow-hidden rounded-[32px] border border-red-500/20 bg-background/60 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center space-y-6 px-8 py-16 text-center">
          <div className="rounded-full bg-red-500/10 p-5 text-red-500 shadow-inner">
            <AlertCircle className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">{locale === "fr" ? "Échec de l'export" : "Export Failed"}</h2>
            <p className="text-muted-foreground line-clamp-3">
              {error || job?.error || (locale === "fr" ? "Une erreur inconnue est survenue" : "An unknown error occurred")}
            </p>
          </div>
          <div className="flex flex-col w-full space-y-3">
            <button 
              onClick={() => window.location.href = "/"}
              className="group flex items-center justify-center space-x-2 rounded-2xl bg-foreground px-8 py-4 font-bold text-background transition-all hover:scale-[1.02] active:scale-95"
            >
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              <span>{locale === "fr" ? "Recharger un lien" : "Reload a link"}</span>
            </button>
            <a 
              href={externalLinks.telegramBot}
              className="flex items-center justify-center space-x-2 rounded-2xl border border-line bg-background/50 px-8 py-4 font-bold transition-all hover:bg-background active:scale-95"
            >
              <ExternalLink className="h-5 w-5" />
              <span>{locale === "fr" ? "Retour au Bot" : "Back to Bot"}</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isCompleted = job.status === "done";
  const isQueued = job.status === "queued";

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[40px] border border-line bg-background/40 shadow-2xl backdrop-blur-3xl transition-all duration-500">
      {/* Media Preview Section */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/20">
        {job.thumbnail ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={job.thumbnail} 
              alt="" 
              className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-40 scale-110" 
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={job.thumbnail} 
              alt={job.title || "Preview"} 
              className="relative h-full w-full object-contain transition-transform duration-700 hover:scale-105" 
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/10 to-transparent">
             <div className="h-20 w-20 rounded-3xl bg-background/50 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                {isCompleted ? <Check className="h-10 w-10 text-green-500" /> : <Loader2 className="h-10 w-10 animate-spin text-primary" />}
             </div>
          </div>
        )}
        
        {/* Status Badge Over Image */}
        <div className="absolute top-6 right-6">
          <div className={`rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg ${
            isCompleted 
              ? 'border-green-500/20 bg-green-500/10 text-green-500' 
              : 'border-primary/20 bg-primary/10 text-primary'
          }`}>
             {job.status}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-10 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight line-clamp-2">
              {job.title || (locale === "fr" ? "Traitement en cours..." : "Processing...")}
            </h1>
            <p className="text-sm font-mono text-muted-foreground/60">ID: {jobId}</p>
          </div>
          {job.platform && (
            <div className="rounded-xl border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
              {job.platform}
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="px-10 py-6 space-y-10">
        <div className="space-y-5">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                 {isCompleted ? (locale === "fr" ? "Terminé" : "Completed") : (locale === "fr" ? "Progression" : "Progress")}
              </span>
              <p className="text-sm font-semibold opacity-80">
                {isCompleted
                  ? (locale === "fr" ? "Fichier prêt" : "File is ready")
                  : (isQueued
                    ? (locale === "fr" ? `Position #${job.queuePosition}` : `Position #${job.queuePosition}`)
                    : job.progressLabel || getFunnyWaiting(locale, jobId))}
              </p>
            </div>
            <div className="text-3xl font-black italic tracking-tighter">
               {Math.round(job.progress)}<span className="text-lg font-bold opacity-30">%</span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted shadow-inner">
             <div 
               className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-primary'}`}
               style={{ width: `${job.progress}%` }}
             />
          </div>
        </div>

        {isCompleted && job.filename && (
          <div className="relative animate-in fade-in zoom-in-95 duration-700">
             <div className="absolute -inset-4 rounded-[40px] bg-primary/10 blur-xl opacity-50" />
             <div className="relative space-y-4">
              <a
                href={`/api/file/${jobId}`}
                download
                className="flex w-full items-center justify-center space-x-3 rounded-[28px] bg-foreground py-6 text-xl font-black text-background shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                <Download className="h-7 w-7" />
                <span>{locale === "fr" ? "TÉLÉCHARGER" : "DOWNLOAD"}</span>
              </a>
              <div className="flex items-center justify-center space-x-2 text-xs font-mono text-muted-foreground/80">
                <span className="block max-w-[80%] truncate overflow-hidden">{job.filename}</span>
              </div>
            </div>
          </div>
        )}

        {!isCompleted && !isQueued && (
            <div className="flex justify-center py-4">
                <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{getFunnyWaiting(locale, jobId)}</span>
                </div>
            </div>
        )}
      </div>

      {/* Premium Footer with Back to Bot */}
      <div className="mt-6 flex items-center justify-between border-t border-line bg-surface-muted/30 p-8">
         <div className="flex space-x-4">
            <a 
              href={externalLinks.telegramBot}
              className="flex items-center space-x-2 rounded-2xl bg-surface-muted px-6 py-3 text-sm font-black transition-all hover:bg-surface-muted/70 active:scale-95 border border-line"
            >
              <ExternalLink className="h-4 w-4" />
              <span>TELEGRAM BOT</span>
            </a>
         </div>
         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
            Powered by PulsorClip
         </p>
      </div>
    </div>
  );
}
