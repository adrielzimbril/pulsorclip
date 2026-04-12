import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRequestLocale } from "@/lib/request-locale";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const isFR = locale === "fr";

  const content = isFR ? {
    title: "Politique de Confidentialité & ",
    terms: "Conditions d'Utilisation",
    updated: "Dernière mise à jour : 12 avril 2026",
    sections: [
      {
        id: 1,
        title: "Usage Éducatif & Personnel",
        body: "PulsorClip est un utilitaire open-source de préservation et de documentation média conçu strictement pour un <strong>usage éducatif, d'archivage et de recherche personnelle</strong>.",
        extra: "En utilisant ce service, vous garantissez que vous possédez les droits sur le média traité ou que vous avez obtenu l'autorisation explicite du détenteur des droits."
      },
      {
        id: 2,
        title: "Passerelle Technique & Responsabilité",
        body: "PulsorClip agit comme une <strong>passerelle technique transitoire</strong>. Le service n'indexe pas, ne catalogue pas et n'héberge pas de bibliothèque de médias. Il fournit une interface localisée pour des bibliothèques open-source standard (yt-dlp, ffmpeg) afin de traiter les URLs fournies par l'utilisateur.",
        extra: "L'opérateur de cette instance n'examine ni n'approuve aucun contenu traité par le système. La responsabilité du choix des URLs et du droit légal de les traiter incombe exclusivement à l'utilisateur final."
      },
      {
        id: 3,
        title: "DMCA & Conformité au Droit d'Auteur",
        body: "Nous respectons les droits de propriété intellectuelle et nous conformons au Digital Millennium Copyright Act (DMCA). Comme ce service est un outil de traitement et ne stocke pas de fichiers de manière permanente (les fichiers sont purgés immédiatement après livraison), nous n'hébergeons pas de contenu contrefait.",
        extra: "<strong>Demandes de retrait :</strong> Bien que nous n'hébergions pas de contenu, si vous pensez que cet outil est utilisé pour faciliter une contrefaçon, vous pouvez contacter l'opérateur à <code>@akaiokami_az</code> sur Telegram."
      },
      {
        id: 4,
        title: "Limite de Responsabilité & Absence de Garantie",
        body: "LE LOGICIEL EST FOURNI \"EN L'ÉTAT\", SANS GARANTIE D'AUCUNE SORTE. EN AUCUN CAS LES OPÉRATEURS, DÉVELOPPEURS OU CONTRIBUTEURS NE SERONT RESPONSABLES DES DOMMAGES DIRECTS, INDIRECTS OU ACCESSOIRES DÉCOULANT DE L'UTILISATION DE CE LOGICIEL.",
        prohibition: "⚠️ INTERDICTION : L'utilisation de cet outil pour télécharger du matériel protégé par le droit d'auteur sans licence commerciale ou autorisation explicite est strictement interdite."
      },
      {
        id: 5,
        title: "Données & Privacy Policy",
        body: "Nous collectons des données techniques minimales (IDs Telegram) uniquement pour faciliter le processus de file d'attente et de livraison. Nous ne suivons pas ce que vous téléchargez au-delà de la période de traitement temporaire requise pour fournir le service."
      }
    ],
    footer: "PulsorClip est un projet auto-hébergé dont les sources sont disponibles. Cette instance est opérée indépendamment."
  } : {
    title: "Privacy Policy & ",
    terms: "Terms of Service",
    updated: "Last updated: April 12, 2026",
    sections: [
      {
        id: 1,
        title: "Educational & Personal Use",
        body: "PulsorClip is an open-source media preservation and documentation utility designed strictly for <strong>educational, archival, and personal research purposes</strong>.",
        extra: "By using this service, you warrant that you either own the copyright to the media being processed or have obtained explicit permission from the rights holder for such processing."
      },
      {
        id: 2,
        title: "Technical Passthrough & Liability",
        body: "PulsorClip acts as a <strong>transient technical passthrough</strong>. The service does not index, catalog, or host a library of media. It provides a localized interface for standard open-source libraries (yt-dlp, ffmpeg) to process user-provided URLs.",
        extra: "The operator of this instance does not review or endorse any content processed through the system. Responsibility for the selection of URLs and the legal right to process them rests solely with the end-user."
      },
      {
        id: 3,
        title: "DMCA & Copyright Compliance",
        body: "We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA). Because this service is a tool for processing content and does not store files permanently (files are purged immediately after delivery), we do not host infringing content.",
        extra: "<strong>Take-down requests:</strong> While we do not host content, if you believe this tool is being used to facilitate infringement, you may contact the operator at <code>@akaiokami_az</code> on Telegram."
      },
      {
        id: 4,
        title: "Liability Cap & No Warranty",
        body: "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND. UNDER NO CIRCUMSTANCES SHALL THE OPERATORS, DEVELOPERS, OR CONTRIBUTORS BE LIABLE FOR ANY DAMAGES ARISING FROM THE USE OF THIS SOFTWARE.",
        prohibition: "⚠️ PROHIBITION: Using this tool to download copyrighted material without commercial licensing or explicit permission is strictly forbidden."
      },
      {
        id: 5,
        title: "Data & Privacy",
        body: "We collect minimal technical data (Telegram User IDs) only to facilitate the queue and delivery process. We do not track what you download beyond the temporary processing period required to provide the service."
      }
    ],
    footer: "PulsorClip is a self-hosted, source-available project. This instance is operated independently."
  };

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8" id="top">
      <SiteHeader locale={locale} />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-display">
              {content.title}<span className="text-primary">{content.terms}</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              {content.updated}
            </p>
          </header>

          <section className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            {content.sections.map((section) => (
              <div key={section.id} className={`rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl ${section.id === 3 ? 'border-destructive/20' : ''}`}>
                <h2 className={`flex items-center gap-2 text-2xl font-bold text-display ${section.id === 3 ? 'text-destructive' : ''}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${section.id === 3 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'} text-sm`}>
                    {section.id}
                  </span>
                  {section.title}
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: section.body }} />
                {section.extra && (
                  <p className={`mt-4 text-muted-foreground leading-relaxed ${section.id !== 3 ? 'italic' : ''}`} dangerouslySetInnerHTML={{ __html: section.extra }} />
                )}
                {section.prohibition && (
                  <div className="mt-4 rounded-lg bg-destructive/10 p-4 font-medium text-destructive">
                    {section.prohibition}
                  </div>
                )}
              </div>
            ))}
          </section>

          <footer className="text-center pt-12 pb-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground italic">
              {content.footer}
            </p>
          </footer>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
