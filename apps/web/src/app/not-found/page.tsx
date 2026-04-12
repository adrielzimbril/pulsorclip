import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRequestLocale } from "@/lib/request-locale";
import Link from "next/link";

export default async function NotFoundPage() {
  const locale = await getRequestLocale();
  const isFR = locale === "fr";

  const content = isFR ? {
    title: "Page Non Trouvée",
    subtitle: "404",
    description: "Désolé, la page que vous recherchez n'existe pas ou a été déplacée.",
    suggestion: "Voici quelques options utiles :",
    home: "Retour à l'accueil",
    search: "Effectuer une recherche",
    help: "Besoin d'aide ?",
    features: [
      "Télécharger des médias",
      "Suivre vos téléchargements",
      "Voir la FAQ",
      "Consulter la documentation"
    ]
  } : {
    title: "Page Not Found",
    subtitle: "404",
    description: "Sorry, the page you're looking for doesn't exist or has been moved.",
    suggestion: "Here are some helpful options:",
    home: "Back to Home",
    search: "Perform a search",
    help: "Need help?",
    features: [
      "Download media",
      "Track your downloads",
      "View FAQ",
      "Read documentation"
    ]
  };

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8">
      <SiteHeader locale={locale} />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[24px] border border-line bg-surface/50 p-8 md:p-12 backdrop-blur-sm shadow-xl">
            <div className="text-center space-y-8">
              {/* 404 Number */}
              <div className="relative">
                <h1 className="text-[120px] font-extrabold leading-none text-display text-primary/20">
                  404
                </h1>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-16 w-16 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-display">
                {content.title}
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
                {content.description}
              </p>

              {/* Suggestions */}
              <div className="pt-6">
                <p className="text-sm font-medium text-muted mb-4">
                  {content.suggestion}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    {content.home}
                  </Link>
                  <Link
                    href="/faq"
                    className="inline-flex items-center justify-center rounded-full border border-line bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
                  >
                    {content.help}
                  </Link>
                </div>
              </div>

              {/* Features */}
              <div className="mx-auto max-w-md pt-8 border-t border-border/50">
                <ul className="space-y-3">
                  {content.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-muted">
                      <svg className="h-4 w-4 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
