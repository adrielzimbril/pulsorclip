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
      
      <main className="flex-1 flex items-center justify-center p-6 py-12">
        <div className="w-full">
            <JobTracker jobId={jobId} locale={locale} />
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
