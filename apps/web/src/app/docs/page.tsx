import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getRequestLocale } from "@/lib/request-locale";

const docsByLocale = {
  en: {
    title: "Product documentation",
    body: "Operational guides for hosting, troubleshooting, and bot usage.",
    cards: [
      {
        href: "/faq",
        title: "FAQ",
        body: "Common yt-dlp failures, cookie issues, Telegram size limits, and platform restrictions.",
      },
      {
        href: "/deployment",
        title: "Deployment",
        body: "Render setup, environment variables, bot startup behavior, and free-plan caveats.",
      },
    ],
  },
  fr: {
    title: "Documentation produit",
    body: "Guides operationnels pour l hebergement, le troubleshooting et l usage du bot.",
    cards: [
      {
        href: "/faq",
        title: "FAQ",
        body: "Erreurs yt-dlp frequentes, problemes de cookies, limites Telegram et restrictions de plateformes.",
      },
      {
        href: "/deployment",
        title: "Deploiement",
        body: "Setup Render, variables d environnement, comportement du bot au demarrage et limites du plan gratuit.",
      },
    ],
  },
} as const;

export default async function DocsPage() {
  const locale = await getRequestLocale();
  const content = docsByLocale[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8" id="top">
      <SiteHeader locale={locale} />
      <section className="rounded-[32px] border border-line bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">Docs</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{content.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">{content.body}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {content.cards.map((card) => (
          <Link className="rounded-[28px] border border-line bg-surface p-6 shadow-sm transition hover:border-foreground" href={card.href} key={card.href}>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">{card.title}</h2>
            <p className="mt-3 text-sm leading-8 text-muted">{card.body}</p>
          </Link>
        ))}
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
