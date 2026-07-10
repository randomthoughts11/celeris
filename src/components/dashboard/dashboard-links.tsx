import Link from "next/link";
import { BarChart3, ExternalLink, Megaphone, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DashboardLinksProps {
  companySlug: string;
  googleLookerUrl?: string;
  metaLookerUrl?: string;
  leadsCount: number;
  showAdsNote?: boolean;
}

export function DashboardLinks({
  companySlug,
  googleLookerUrl,
  metaLookerUrl,
  leadsCount,
  showAdsNote,
}: DashboardLinksProps) {
  const hasLooker = googleLookerUrl || metaLookerUrl;

  if (!hasLooker && !showAdsNote) return null;

  return (
    <Card className="border-violet-500/20 bg-violet-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4 text-violet-400" />
            Performance dashboards
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {showAdsNote
              ? "Ad spend & ROAS live in Looker Studio (Porter). CRM tracks leads and operations."
              : "Live campaign metrics from your connected reports."}
            {leadsCount > 0 && (
              <span className="ml-1 text-foreground">
                · {leadsCount} leads in CRM
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {googleLookerUrl && (
            <Link href={`/companies/${companySlug}/google-ads`}>
              <Button size="sm" variant="outline" className="gap-2">
                <Megaphone className="h-3.5 w-3.5" />
                Google Ads
              </Button>
            </Link>
          )}
          {metaLookerUrl && (
            <Link href={`/companies/${companySlug}/meta-ads`}>
              <Button size="sm" variant="outline" className="gap-2">
                <Target className="h-3.5 w-3.5" />
                Meta Ads
              </Button>
            </Link>
          )}
          {googleLookerUrl && (
            <a href={googleLookerUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="gap-1">
                Open Google report
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
