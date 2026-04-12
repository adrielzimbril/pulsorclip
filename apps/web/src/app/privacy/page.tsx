import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <SiteHeader />
      
      <main className="container mx-auto flex-1 px-4 py-12 md:py-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-display">
              Privacy Policy & <span className="text-primary">Terms of Service</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Last updated: April 12, 2026
            </p>
          </header>

          <section className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            <div className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-display">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">1</span>
                Educational & Personal Use
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                PulsorClip is an open-source media preservation and documentation utility designed strictly for <strong>educational, archival, and personal research purposes</strong>. 
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed italic">
                By using this service, you warrant that you either own the copyright to the media being processed or have obtained explicit permission from the rights holder for such processing.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-display">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">2</span>
                Technical Passthrough & Liability
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                PulsorClip acts as a <strong>transient technical passthrough</strong>. The service does not index, catalog, or host a library of media. It provides a localized interface for standard open-source libraries (yt-dlp, ffmpeg) to process user-provided URLs.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                The operator of this instance does not review or endorse any content processed through the system. Responsibility for the selection of URLs and the legal right to process them rests solely with the end-user.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl border-destructive/20">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-display text-destructive">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive text-sm">3</span>
                DMCA & Copyright Compliance
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA). Because this service is a tool for processing content and does not store files permanently (files are purged immediately after delivery or after a short timeout), we do not host infringing content.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                <strong>Take-down requests:</strong> While we do not host content, if you believe this tool is being used to facilitate infringement, you may contact the operator at <code>@akaiokami_az</code> on Telegram.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-display">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">4</span>
                Liability Cap & No Warranty
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. UNDER NO CIRCUMSTANCES SHALL THE OPERATORS, DEVELOPERS, OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OF THIS SOFTWARE, INCLUDING LEGAL FEES OR CONTENT INFRINGEMENT CLAIMS BROUGHT BY THIRD PARTIES.
              </p>
              <div className="mt-4 rounded-lg bg-destructive/10 p-4 font-medium text-destructive">
                ⚠️ PROHIBITION: Using this tool to download copyrighted material without commercial licensing or explicit permission is strictly forbidden.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm shadow-xl">
              <h2 className="flex items-center gap-2 text-1xl font-bold text-display">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">5</span>
                Data & Privacy
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                We collect minimal technical data (Telegram User IDs) only to facilitate the queue and delivery process. We do not track what you download beyond the temporary processing period required to provide the service.
              </p>
            </div>
          </section>

          <footer className="text-center pt-12 pb-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground italic">
              PulsorClip is a self-hosted, source-available project. This instance is operated independently.
            </p>
          </footer>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
