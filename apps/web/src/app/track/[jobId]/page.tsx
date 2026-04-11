import { JobTracker } from "@/components/clip/job-tracker";
import { getRequestLocale } from "@/lib/request-locale";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const locale = await getRequestLocale();
  const { jobId } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-foreground/10">
      <SiteHeader locale={locale} />
      
      <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-4 px-2 pt-6 pb-2 sm:gap-6 sm:px-4 sm:pt-14 sm:pb-4 lg:px-8">
        <section className="mt-4 rounded-[20px] border border-line bg-surface p-3 sm:rounded-[28px] sm:p-5">
          <JobTracker jobId={jobId} locale={locale} />
        </section>
        <div className="pb-2">
          <SiteFooter locale={locale} />
        </div>
      </main>
    </div>
  );
}
