import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRequestLocale } from "@/lib/request-locale";

export default async function DMCAPage() {
  const locale = await getRequestLocale();
  const isFR = locale === "fr";

  const content = isFR ? {
    title: "Politique ",
    highlight: "DMCA",
    updated: "Dernière mise à jour : 12 avril 2026",
    intro: "Conformément au Digital Millennium Copyright Act (DMCA), PulsorClip a adopté la politique suivante concernant la violation du droit d'auteur.",
    sections: [
      {
        id: "nature",
        title: "Nature du Service",
        body: "PulsorClip est un <strong>outil technique de traitement transitoire</strong>. Nous ne possédons pas de serveurs de stockage de contenu à long terme. Les fichiers traités par notre système sont temporairement stockés uniquement pour la livraison à l'utilisateur et sont supprimés immédiatement après."
      },
      {
        id: "notice",
        title: "Notification de Violation",
        body: "Si vous êtes un détenteur de droits d'auteur ou un agent de celui-ci et que vous pensez que du contenu traité via notre service viole vos droits, veuillez soumettre une notification contenant les informations suivantes :",
        list: [
          "Une signature physique ou électronique du détenteur des droits ou de la personne autorisée à agir en son nom ;",
          "Identification de l'œuvre protégée par le droit d'auteur prétendument violée ;",
          "Identification de l'URL ou du matériel spécifique traité qui fait l'objet de la plainte ;",
          "Vos coordonnées (adresse, numéro de téléphone et e-mail) ;",
          "Une déclaration de bonne foi indiquant que l'utilisation du matériel n'est pas autorisée ;",
          "Une déclaration, sous peine de parjure, que les informations contenues dans la notification sont exactes."
        ]
      },
      {
        id: "contact",
        title: "Contact de l'Agent DMCA",
        body: "Les notifications doivent être envoyées à l'opérateur via Telegram pour une réponse rapide :",
        contact: "@akaiokami_az",
        note: "Veuillez noter que l'envoi de fausses notifications de violation peut entraîner des conséquences juridiques."
      }
    ]
  } : {
    title: "DMCA ",
    highlight: "Policy",
    updated: "Last updated: April 12, 2026",
    intro: "In accordance with the Digital Millennium Copyright Act (DMCA), PulsorClip has adopted the following policy toward copyright infringement.",
    sections: [
      {
        id: "nature",
        title: "Nature of Service",
        body: "PulsorClip is a <strong>transient technical processing tool</strong>. We do not operate long-term content storage servers. Files processed by our system are temporarily stored only for delivery to the user and are deleted immediately thereafter."
      },
      {
        id: "notice",
        title: "Reporting Infringement",
        body: "If you are a copyright owner or an agent thereof and believe that any content processed via our service infringes upon your copyrights, please submit a notification containing the following information:",
        list: [
          "A physical or electronic signature of the copyright owner or person authorized to act on their behalf;",
          "Identification of the copyrighted work claimed to have been infringed;",
          "Identification of the specific URL or material processed that is the subject of the complaint;",
          "Your contact information (address, telephone number, and email);",
          "A statement of good faith belief that the use of the material is not authorized;",
          "A statement, under penalty of perjury, that the information in the notification is accurate."
        ]
      },
      {
        id: "contact",
        title: "DMCA Agent Contact",
        body: "Notifications should be sent to the operator via Telegram for the fastest response:",
        contact: "@akaiokami_az",
        note: "Please note that submitting false infringement notifications may lead to legal consequences."
      }
    ]
  };

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8" id="top">
      <SiteHeader locale={locale} />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-display">
              {content.title}<span className="text-destructive">{content.highlight}</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              {content.updated}
            </p>
          </header>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <p className="text-lg leading-relaxed text-muted-foreground text-center italic">
              {content.intro}
            </p>

            {content.sections.map((section) => (
              <div key={section.id} className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl">
                <h2 className="text-2xl font-bold text-display mb-4">
                  {section.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: section.body }} />
                
                {section.list && (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-muted-foreground">
                    {section.list.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.contact && (
                  <div className="mt-6 flex flex-col items-center gap-4 rounded-xl bg-primary/5 p-6 border border-primary/10">
                    <span className="text-lg font-mono font-bold text-primary">{section.contact}</span>
                    <p className="text-sm text-muted-foreground italic text-center">{section.note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
