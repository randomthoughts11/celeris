import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { AdsAccountBar } from "@/components/companies/ads-account-bar";
import { LookerStudioEmbed } from "@/components/reports/looker-studio-embed";
import { LookerReportSettings } from "@/components/reports/looker-report-settings";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAiInsights, getGoogleAdsCampaigns } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageBrandSetup } from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
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

  const [campaigns, insights, googleIntegration, agencyConnected] =
    await Promise.all([
      getGoogleAdsCampaigns(company.id),
      getAiInsights(company.id),
      getIntegration(company.id, "google_ads"),
      isAgencyConnected("google"),
    ]);

  const canManage = canManageBrandSetup(user);
  const canSync = hasPermission(user.roles, "MANAGE_CAMPAIGNS");
  const lookerEmbedUrl =
    typeof googleIntegration?.config?.lookerEmbedUrl === "string"
      ? googleIntegration.config.lookerEmbedUrl
      : undefined;
  const linkedName =
    typeof googleIntegration?.config?.customerName === "string"
      ? googleIntegration.config.customerName
      : typeof googleIntegration?.config?.customerId === "string"
        ? googleIntegration.config.customerId
        : undefined;

  const active = campaigns.filter((c) => c.status === "active");
  const paused = campaigns.filter((c) => c.status === "paused");
  const totalSpend = campaigns.reduce((s, c) => s + c.daily_spend, 0);
  const googleInsights = insights.filter((i) => i.module === "google_ads");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
          Ads report
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Google Ads</h1>
        <p className="text-muted-foreground">
          Live Looker dashboard for this brand.
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
        <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
          No Google Ads dashboard linked for this brand yet.
        </Card>
      )}

      <AdsAccountBar
        companyId={company.id}
        provider="google_ads"
        agencyConnected={agencyConnected}
        linkedAccountName={linkedName}
        lastSyncedAt={googleIntegration?.last_synced_at}
        canManage={canManage}
        canSync={canSync}
      />

      {campaigns.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">30-day spend</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalSpend)}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold">{active.length}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Paused</p>
              <p className="text-2xl font-semibold">{paused.length}</p>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] p-5">
              <p className="text-sm text-muted-foreground">Campaigns</p>
              <p className="text-2xl font-semibold">{campaigns.length}</p>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Synced campaigns</h2>
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
                  <div className="text-right">
                    <p className="text-lg font-semibold text-emerald-400">
                      {formatRoas(campaign.roas)}
                    </p>
                    <p className="text-xs text-muted-foreground">ROAS (30d)</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <Stat label="Spend" value={formatCurrency(campaign.daily_spend)} />
                  <Stat label="Clicks" value={formatNumber(campaign.clicks)} />
                  <Stat
                    label="Impressions"
                    value={formatNumber(campaign.impressions)}
                  />
                  <Stat label="CTR" value={formatPercent(campaign.ctr)} />
                  <Stat label="CPC" value={formatCurrency(campaign.cpc)} />
                  <Stat
                    label="Conversions"
                    value={String(Math.round(campaign.conversions))}
                  />
                </div>
              </Card>
            ))}
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
