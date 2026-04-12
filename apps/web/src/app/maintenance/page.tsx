import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRequestLocale } from "@/lib/request-locale";

export default async function MaintenancePage() {
  const locale = await getRequestLocale();
  const isFR = locale === "fr";

  const content = isFR ? {
    title: "Maintenance en Cours",
    subtitle: "Nous revenons très bientôt",
    description: "PulsorClip est actuellement en maintenance pour améliorer nos services. Nous travaillons activement pour vous offrir une expérience encore meilleure.",
    estimatedTime: "Temps estimé: Quelques heures",
    features: [
      "Amélioration des performances",
      "Nouvelles fonctionnalités",
      "Mises à jour de sécurité",
      "Optimisation du téléchargement"
    ],
    contact: "Besoin d'aide ? Contactez-nous sur",
    telegram: "Telegram"
  } : {
    title: "Under Maintenance",
    subtitle: "We'll be back soon",
    description: "PulsorClip is currently under maintenance to improve our services. We're working hard to provide you with an even better experience.",
    estimatedTime: "Estimated time: A few hours",
    features: [
      "Performance improvements",
      "New features",
      "Security updates",
      "Download optimization"
    ],
    contact: "Need help? Contact us on",
    telegram: "Telegram"
  };

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8">
      <SiteHeader locale={locale} />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[24px] border border-line bg-surface/50 p-8 md:p-12 backdrop-blur-sm shadow-xl">
            {/* Icon */}
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
              <svg
                className="h-12 w-12 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="text-center space-y-6">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-display">
                {content.title}
              </h1>
              
              <p className="text-2xl font-semibold text-primary">
                {content.subtitle}
              </p>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                {content.description}
              </p>

              {/* Estimated Time */}
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-background/50 px-4 py-2 text-sm font-medium text-muted">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {content.estimatedTime}
              </div>

              {/* Features */}
              <div className="mx-auto max-w-md pt-8">
                <ul className="space-y-3">
                  {content.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-muted">
                      <svg className="h-5 w-5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div className="pt-8 border-t border-border/50">
                <p className="text-sm text-muted">
                  {content.contact}{" "}
                  <a
                    href="https://t.me/akaiokami_az"
                    className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {content.telegram}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
