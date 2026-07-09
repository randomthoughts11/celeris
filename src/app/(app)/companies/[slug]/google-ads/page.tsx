import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LookerStudioEmbed } from "@/components/reports/looker-studio-embed";
import { LookerReportSettings } from "@/components/reports/looker-report-settings";
import {
  getAiInsights,
  getGoogleAdsCampaigns,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageCompanies } from "@/lib/auth/access";
import { getIntegration } from "@/lib/db/integrations";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  getCampaignStatusColor,
} from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GoogleAdsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("google-ads");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [campaigns, insights, googleIntegration] = await Promise.all([
    getGoogleAdsCampaigns(company.id),
    getAiInsights(company.id),
    getIntegration(company.id, "google_ads"),
  ]);

  const lookerEmbedUrl =
    typeof googleIntegration?.config?.lookerEmbedUrl === "string"
      ? googleIntegration.config.lookerEmbedUrl
      : undefined;
  const canManage = canManageCompanies(user);

  const active = campaigns.filter((c) => c.status === "active");
  const paused = campaigns.filter((c) => c.status === "paused");
  const totalSpend = campaigns.reduce((s, c) => s + c.daily_spend, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const googleInsights = insights.filter((i) => i.module === "google_ads");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
        <p className="text-muted-foreground">
          Campaign performance and budget management
        </p>
      </div>

      {canManage && (
        <LookerReportSettings
          companyId={company.id}
          provider="google_ads"
          currentUrl={lookerEmbedUrl}
          label="Google Ads"
        />
      )}

      {lookerEmbedUrl ? (
        <LookerStudioEmbed
          url={lookerEmbedUrl}
          title={`${company.name} Google Ads`}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Daily Spend</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalSpend)}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Active Campaigns</p>
              <p className="text-2xl font-semibold">{active.length}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Paused</p>
              <p className="text-2xl font-semibold">{paused.length}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalBudget)}</p>
            </Card>
          </div>

          {paused.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-400">
                Budget Alert: {paused.length} paused campaign
                {paused.length > 1 ? "s" : ""} require review
              </p>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Campaigns</h2>
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
                    <p className="mt-1 text-sm text-muted-foreground">
                      ID: {campaign.external_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-emerald-400">
                      {formatRoas(campaign.roas)}
                    </p>
                    <p className="text-xs text-muted-foreground">ROAS</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <Stat label="Clicks" value={formatNumber(campaign.clicks)} />
                  <Stat label="Impressions" value={formatNumber(campaign.impressions)} />
                  <Stat label="CTR" value={formatPercent(campaign.ctr)} />
                  <Stat label="CPC" value={formatCurrency(campaign.cpc)} />
                  <Stat label="Conversions" value={String(campaign.conversions)} />
                  <Stat
                    label="Cost/Conv"
                    value={formatCurrency(campaign.cost_per_conversion)}
                  />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      Daily: {formatCurrency(campaign.daily_spend)} · Remaining:{" "}
                      {formatCurrency(campaign.remaining_budget)}
                    </span>
                    <span>
                      {campaign.budget > 0
                        ? (
                            ((campaign.budget - campaign.remaining_budget) /
                              campaign.budget) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      campaign.budget > 0
                        ? ((campaign.budget - campaign.remaining_budget) /
                            campaign.budget) *
                          100
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>
              </Card>
            ))}

            {campaigns.length === 0 && (
              <Card className="border-white/5 bg-white/[0.02] p-12 text-center">
                <p className="text-muted-foreground">
                  {canManage
                    ? "Paste your Porter / Looker Studio embed URL above, or connect Google in settings to sync campaigns."
                    : "No Google Ads dashboard configured yet."}
                </p>
              </Card>
            )}
          </div>
        </>
      )}

      {googleInsights.length > 0 && (
        <AiInsightsPanel insights={googleInsights} companyId={company.id} />
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
