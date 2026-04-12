import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getRequestLocale } from "@/lib/request-locale";
import Link from "next/link";

export default async function ErrorPage() {
  const locale = await getRequestLocale();
  const isFR = locale === "fr";

  const content = isFR ? {
    title: "Erreur Serveur",
    subtitle: "500",
    description: "Une erreur inattendue s'est produite sur nos serveurs. Nos équipes ont été notifiées et travaillent à résoudre le problème.",
    suggestion: "Voici ce que vous pouvez faire :",
    retry: "Réessayer",
    home: "Retour à l'accueil",
    support: "Contacter le support",
    steps: [
      "Actualisez la page",
      "Vérifiez votre connexion internet",
      "Réessayez dans quelques minutes",
      "Contactez-nous si le problème persiste"
    ]
  } : {
    title: "Server Error",
    subtitle: "500",
    description: "An unexpected error occurred on our servers. Our team has been notified and is working to resolve the issue.",
    suggestion: "Here's what you can do:",
    retry: "Try Again",
    home: "Back to Home",
    support: "Contact Support",
    steps: [
      "Refresh the page",
      "Check your internet connection",
      "Try again in a few minutes",
      "Contact us if the problem persists"
    ]
  };

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4 lg:max-w-[1320px] lg:px-8">
      <SiteHeader locale={locale} />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-8 md:p-12 backdrop-blur-sm shadow-xl">
            <div className="text-center space-y-8">
              {/* 500 Number */}
              <div className="relative">
                <h1 className="text-[120px] font-extrabold leading-none text-display text-destructive/20">
                  500
                </h1>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-16 w-16 text-destructive"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-display text-destructive">
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
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {content.retry}
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-line bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
                  >
                    {content.home}
                  </Link>
                  <a
                    href="https://t.me/akaiokami_az"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-line bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface"
                  >
                    {content.support}
                  </a>
                </div>
              </div>

              {/* Steps */}
              <div className="mx-auto max-w-md pt-8 border-t border-border/50">
                <ul className="space-y-3">
                  {content.steps.map((step, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-muted">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                        {index + 1}
                      </span>
                      {step}
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
