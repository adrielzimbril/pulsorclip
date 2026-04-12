import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getRequestLocale } from "@/lib/request-locale";

const docsByLocale = {
  en: {
    title: "Product documentation",
    body: "Operational references for hosting, troubleshooting, and running PulsorClip without guesswork.",
    summaryTitle: "Use docs when the workspace is not enough",
    summaryBody:
      "The app is optimized for action first. The documentation pages exist to resolve blockers fast: source failures, cookie issues, delivery limits, and deployment decisions.",
    cards: [
      {
        href: "/faq",
        title: "FAQ",
        body: "Go here when a job fails, a source is blocked, or a platform requires cookies or account context.",
      },
      {
        href: "/deployment",
        title: "Deployment",
        body: "Go here when you need the right environment variables, Server setup, or bot startup behavior.",
      },
    ],
  },
  fr: {
    title: "Documentation produit",
    body: "References operationnelles pour heberger, debloquer et exploiter PulsorClip sans approximation.",
    summaryTitle: "Utilise la doc quand le workspace ne suffit plus",
    summaryBody:
      "L application privilegie l action. Les pages de documentation servent a lever rapidement les blocages: sources en echec, cookies, limites de livraison, et choix de deploiement.",
    cards: [
      {
        href: "/faq",
        title: "FAQ",
        body: "Va ici quand un job echoue, qu une source est bloquee, ou qu une plateforme demande des cookies ou un contexte de compte.",
      },
      {
        href: "/deployment",
        title: "Deploiement",
        body: "Va ici pour les variables d environnement, le setup Serveur, et le comportement de demarrage du bot.",
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
      <section className="rounded-[28px] border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{content.summaryTitle}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-8 text-muted">{content.summaryBody}</p>
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
