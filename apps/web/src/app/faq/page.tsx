import Link from "next/link";
import { t } from "@pulsorclip/core/i18n";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getRequestLocale } from "@/lib/request-locale";

const faqContent = {
  en: {
    heading: "yt-dlp and deployment troubleshooting",
    intro: "Common failure modes, cookie setup reminders, and practical fixes for PulsorClip on local and hosted environments.",
    checklistTitle: "Quick triage",
    checklist: [
      "Confirm the source URL still opens in a browser.",
      "Check whether the source needs authenticated cookies.",
      "Verify yt-dlp and ffmpeg are present on the host.",
      "Use deployment logs before changing code or env blindly.",
    ],
    resources: "Resources",
    cookieGuide: "yt-dlp cookie guide",
    exportCookies: "Export YouTube cookies",
    entries: [
      {
        id: "error-ytdlp-bot-check",
        title: "YouTube asks to sign in and confirm you are not a bot",
        body: "This is the most common yt-dlp failure on hosted environments. You need authenticated cookies through YTDLP_COOKIES_FROM_BROWSER, YTDLP_COOKIES_FILE, or YTDLP_COOKIES_BASE64.",
      },
      {
        id: "error-private-media",
        title: "Private or restricted media",
        body: "The source is private, geo-restricted, age-gated, or requires an authenticated account that yt-dlp cannot access with your current cookies.",
      },
      {
        id: "error-no-file",
        title: "Export finished without a file",
        body: "This usually means the host storage is ephemeral or ffmpeg failed during merge or extraction. Check Render logs and confirm ffmpeg is installed in the container.",
      },
      {
        id: "error-telegram-size",
        title: "Telegram did not send the file",
        body: "Telegram has upload limits. If the file is too large, the bot falls back to the web workflow. Download from the browser instead.",
      },
    ],
  },
  fr: {
    heading: "Troubleshooting yt-dlp et deploiement",
    intro: "Erreurs frequentes, rappels sur les cookies et corrections pratiques pour PulsorClip en local comme en environnement heberge.",
    checklistTitle: "Triage rapide",
    checklist: [
      "Verifie d abord que l URL fonctionne encore dans un navigateur.",
      "Controle si la source demande des cookies authentifies.",
      "Verifie que yt-dlp et ffmpeg sont bien presents sur l host.",
      "Lis les logs de deploiement avant de modifier le code ou l env a l aveugle.",
    ],
    resources: "Ressources",
    cookieGuide: "Guide cookies yt-dlp",
    exportCookies: "Exporter les cookies YouTube",
    entries: [
      {
        id: "error-ytdlp-bot-check",
        title: "YouTube demande une connexion et une verification anti-bot",
        body: "C est l erreur yt-dlp la plus frequente en environnement heberge. Il faut fournir des cookies authentifies via YTDLP_COOKIES_FROM_BROWSER, YTDLP_COOKIES_FILE ou YTDLP_COOKIES_BASE64.",
      },
      {
        id: "error-private-media",
        title: "Media prive ou restreint",
        body: "La source est privee, geobloquee, limitee par age, ou demande un compte authentifie que yt-dlp ne peut pas utiliser avec tes cookies actuels.",
      },
      {
        id: "error-no-file",
        title: "Export termine sans fichier final",
        body: "Cela signifie souvent que le stockage de l hebergement est ephemere ou que ffmpeg a echoue pendant la fusion ou l extraction. Verifie les logs Render et la presence de ffmpeg dans le conteneur.",
      },
      {
        id: "error-telegram-size",
        title: "Telegram n a pas envoye le fichier",
        body: "Telegram impose des limites d upload. Si le fichier est trop gros, le bot bascule vers le workflow web. Telecharge depuis le navigateur.",
      },
    ],
  },
} as const;

export default async function FaqPage() {
  const locale = await getRequestLocale();
  const content = faqContent[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8" id="top">
      <SiteHeader locale={locale} />
      <section className="rounded-[32px] border border-line bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">FAQ</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{content.heading}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">{content.intro}</p>
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.checklistTitle}</h2>
        <ul className="mt-4 space-y-3 text-sm leading-8 text-muted">
          {content.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        {content.entries.map((entry) => (
          <article className="rounded-[28px] border border-line bg-surface p-6 shadow-sm" id={entry.id} key={entry.id}>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">{entry.title}</h2>
            <p className="mt-3 text-sm leading-8 text-muted">{entry.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.resources}</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <a className="rounded-full border border-line px-4 py-3" href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp" rel="noreferrer" target="_blank">
            {content.cookieGuide}
          </a>
          <a className="rounded-full border border-line px-4 py-3" href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies" rel="noreferrer" target="_blank">
            {content.exportCookies}
          </a>
          <Link className="rounded-full border border-line px-4 py-3" href="/deployment">
            {t(locale, "navDeployment")}
          </Link>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
