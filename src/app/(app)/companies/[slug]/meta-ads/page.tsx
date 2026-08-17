import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LookerStudioEmbed } from "@/components/reports/looker-studio-embed";
import { LookerReportSettings } from "@/components/reports/looker-report-settings";
import {
  getAiInsights,
  getMetaAdsCampaigns,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageBrandSetup } from "@/lib/auth/access";
import { getIntegration } from "@/lib/db/integrations";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  getCampaignStatusColor,
  getHealthColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MetaAdsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("meta-ads");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [campaigns, insights, metaIntegration] = await Promise.all([
    getMetaAdsCampaigns(company.id),
    getAiInsights(company.id),
    getIntegration(company.id, "meta_ads"),
  ]);

  const lookerEmbedUrl =
    typeof metaIntegration?.config?.lookerEmbedUrl === "string"
      ? metaIntegration.config.lookerEmbedUrl
      : undefined;
  const canManage = canManageBrandSetup(user);

  const metaInsights = insights.filter((i) => i.module === "meta_ads");
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meta Ads</h1>
        <p className="text-muted-foreground">
          Facebook & Instagram campaign performance
        </p>
      </div>

      {canManage && (
        <LookerReportSettings
          companyId={company.id}
          provider="meta_ads"
          currentUrl={lookerEmbedUrl}
          label="Meta Ads"
        />
      )}

      {lookerEmbedUrl ? (
        <LookerStudioEmbed url={lookerEmbedUrl} title={`${company.name} Meta Ads`} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Total Spend</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalSpend)}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Campaigns</p>
              <p className="text-2xl font-semibold">{campaigns.length}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Avg Health</p>
              <p className="text-2xl font-semibold">
                {campaigns.length
                  ? Math.round(
                      campaigns.reduce((s, c) => s + c.health_score, 0) /
                        campaigns.length
                    )
                  : 0}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <Badge variant={getCampaignStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          getHealthColor(campaign.health_score)
                        )}
                      >
                        {campaign.health_score}
                      </p>
                      <p className="text-xs text-muted-foreground">Health</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-emerald-400">
                        {formatRoas(campaign.roas)}
                      </p>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Reach" value={formatNumber(campaign.reach)} />
                  <Stat label="Impressions" value={formatNumber(campaign.impressions)} />
                  <Stat label="Frequency" value={campaign.frequency.toFixed(2)} />
                  <Stat label="CTR" value={formatPercent(campaign.ctr)} />
                  <Stat label="Conversions" value={String(campaign.conversions)} />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Spend</p>
                    <p className="font-medium">{formatCurrency(campaign.spend)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Budget Remaining</p>
                    <p className="font-medium">
                      {formatCurrency(campaign.budget_remaining)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}

            {campaigns.length === 0 && (
              <Card className="border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-muted-foreground">
                  {canManage
                    ? "Paste your Porter / Looker Studio embed URL above, or connect Meta in settings to sync campaigns."
                    : "No Meta Ads dashboard configured yet."}
                </p>
              </Card>
            )}
          </div>
        </>
      )}

      {metaInsights.length > 0 && (
        <AiInsightsPanel insights={metaInsights} companyId={company.id} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
