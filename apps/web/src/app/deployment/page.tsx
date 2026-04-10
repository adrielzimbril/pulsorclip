import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getRequestLocale } from "@/lib/request-locale";

const deploymentContent = {
  en: {
    heading: "Render deployment guide",
    intro: "PulsorClip currently targets a single Docker-backed Render web service on the free plan. The bot and the web app start from the same container.",
    flowTitle: "Deployment flow",
    envTitle: "Environment variables",
    notesTitle: "Notes",
    steps: [
      "Create a new Render Blueprint from the GitHub repository.",
      "Keep the repository root unchanged so Docker can access apps/web, apps/bot, and packages/core.",
      "Set NEXT_PUBLIC_APP_URL to your own public domain or deployment URL.",
      "Fill TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS, and optional yt-dlp cookie variables.",
      "Deploy the free web service and attach the custom domain in Render settings.",
    ],
    envRows: [
      ["NEXT_PUBLIC_APP_URL", "Public web URL used for metadata, SEO, and bot links."],
      ["TELEGRAM_BOT_ENABLED", "Enable or disable the Telegram polling process."],
      ["TELEGRAM_BOT_TOKEN", "Required to start the Telegram bot process."],
      ["TELEGRAM_ADMIN_IDS", "Comma-separated Telegram user IDs notified when the bot becomes live."],
      ["TELEGRAM_MAINTENANCE_MODE", "When true, non-admin users receive maintenance responses."],
      ["YTDLP_COOKIES_BASE64", "Recommended hosted-platform cookie option for YouTube."],
      ["PULSORCLIP_DOWNLOAD_DIR", "Use /tmp/pulsorclip-downloads on Render free."],
    ],
    notes: [
      "Render free storage is ephemeral, so prepared files may disappear after restart or redeploy.",
      "For YouTube, cookies are often required on hosted IP ranges.",
      "Root path stays at the repository root because the Docker build depends on the full monorepo.",
      "The bot sends startup notifications only when TELEGRAM_ADMIN_IDS contains valid Telegram user IDs.",
    ],
  },
  fr: {
    heading: "Guide de deploiement Render",
    intro: "PulsorClip cible actuellement un seul web service Render base sur Docker en plan gratuit. Le bot et l app web demarrent depuis le meme conteneur.",
    flowTitle: "Flux de deploiement",
    envTitle: "Variables d environnement",
    notesTitle: "Notes",
    steps: [
      "Cree un nouveau Blueprint Render depuis le repository GitHub.",
      "Garde la racine du repository telle quelle pour que Docker puisse acceder a apps/web, apps/bot et packages/core.",
      "Definis NEXT_PUBLIC_APP_URL sur ton propre domaine public ou ton URL de deploiement.",
      "Renseigne TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS et les cookies yt-dlp si necessaire.",
      "Deploie le web service gratuit puis attache le domaine custom dans les reglages Render.",
    ],
    envRows: [
      ["NEXT_PUBLIC_APP_URL", "URL web publique utilisee pour les metadata, le SEO et les liens du bot."],
      ["TELEGRAM_BOT_ENABLED", "Active ou desactive le process Telegram polling."],
      ["TELEGRAM_BOT_TOKEN", "Necessaire pour demarrer le bot Telegram."],
      ["TELEGRAM_ADMIN_IDS", "IDs Telegram separes par des virgules pour notifier les admins quand le bot devient disponible."],
      ["TELEGRAM_MAINTENANCE_MODE", "Quand la valeur est true, les non-admins recoivent des reponses de maintenance."],
      ["YTDLP_COOKIES_BASE64", "Option recommandee pour les cookies YouTube sur une plateforme hebergee."],
      ["PULSORCLIP_DOWNLOAD_DIR", "Utilise /tmp/pulsorclip-downloads sur Render free."],
    ],
    notes: [
      "Le stockage Render free est ephemere, donc les fichiers prepares peuvent disparaitre apres restart ou redeploy.",
      "Pour YouTube, les cookies sont souvent requis sur des IP hebergees.",
      "La racine reste celle du repository car le build Docker depend de tout le monorepo.",
      "Le bot n envoie des notifications de demarrage que si TELEGRAM_ADMIN_IDS contient des IDs Telegram valides.",
    ],
  },
} as const;

export default async function DeploymentPage() {
  const locale = await getRequestLocale();
  const content = deploymentContent[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8" id="top">
      <SiteHeader locale={locale} />
      <section className="rounded-[32px] border border-line bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">Deployment</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{content.heading}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">{content.intro}</p>
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.flowTitle}</h2>
        <ol className="mt-4 space-y-3 text-sm leading-8 text-muted">
          {content.steps.map((step, index) => (
            <li key={step}>{index + 1}. {step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.envTitle}</h2>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-background">
              <tr>
                <th className="border-b border-line px-4 py-3 font-semibold">Key</th>
                <th className="border-b border-line px-4 py-3 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {content.envRows.map(([key, value]) => (
                <tr key={key}>
                  <td className="border-b border-line px-4 py-3 font-mono text-xs">{key}</td>
                  <td className="border-b border-line px-4 py-3 text-muted">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.notesTitle}</h2>
        <ul className="mt-4 space-y-3 text-sm leading-8 text-muted">
          {content.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
