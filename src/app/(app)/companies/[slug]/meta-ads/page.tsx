import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { AdsAccountBar } from "@/components/companies/ads-account-bar";
import { LookerStudioEmbed } from "@/components/reports/looker-studio-embed";
import { LookerReportSettings } from "@/components/reports/looker-report-settings";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAiInsights, getMetaAdsCampaigns } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageBrandSetup } from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
import { getIntegration } from "@/lib/db/integrations";
import {
  listMetaAdSets,
  listMetaAds,
  getAttributionSummary,
  getCampaignAttributionSummary,
} from "@/lib/db/attribution";
import { getBranchPerformance } from "@/lib/db/branches";
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

  const [
    campaigns,
    insights,
    metaIntegration,
    agencyConnected,
    adSets,
    ads,
    attribution,
    campaignAttribution,
    branchPerf,
  ] = await Promise.all([
    getMetaAdsCampaigns(company.id),
    getAiInsights(company.id),
    getIntegration(company.id, "meta_ads"),
    isAgencyConnected("meta"),
    listMetaAdSets(company.id).catch(() => []),
    listMetaAds(company.id).catch(() => []),
    getAttributionSummary(company.id).catch(() => []),
    getCampaignAttributionSummary(company.id).catch(() => []),
    getBranchPerformance(company.id).catch(() => []),
  ]);

  const canManage = canManageBrandSetup(user);
  const canSync = hasPermission(user.roles, "MANAGE_CAMPAIGNS");
  const linkedName =
    typeof metaIntegration?.config?.adAccountName === "string"
      ? metaIntegration.config.adAccountName
      : typeof metaIntegration?.config?.adAccountId === "string"
        ? metaIntegration.config.adAccountId
        : undefined;

  const metaInsights = insights.filter((i) => i.module === "meta_ads");
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = adSets.reduce((s, a) => s + a.leads_count, 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const lookerEmbedUrl =
    typeof metaIntegration?.config?.lookerEmbedUrl === "string"
      ? metaIntegration.config.lookerEmbedUrl
      : undefined;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
          Ads report
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Meta Ads</h1>
        <p className="text-muted-foreground">
          Live Looker dashboard for this brand.
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
        <LookerStudioEmbed
          url={lookerEmbedUrl}
          title={`${company.name} Meta Ads`}
        />
      ) : (
        <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
          No Meta Ads dashboard linked for this brand yet.
        </Card>
      )}

      <AdsAccountBar
        companyId={company.id}
        provider="meta_ads"
        agencyConnected={agencyConnected}
        linkedAccountName={linkedName}
        lastSyncedAt={metaIntegration?.last_synced_at}
        canManage={canManage}
        canSync={canSync}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">30-day spend</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalSpend)}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Campaigns</p>
          <p className="text-2xl font-semibold">{campaigns.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Ad sets / Ads</p>
          <p className="text-2xl font-semibold">
            {adSets.length} / {ads.length}
          </p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Leads · CPL</p>
          <p className="text-2xl font-semibold">
            {totalLeads} · {formatCurrency(cpl)}
          </p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Avg health</p>
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

      {attribution.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Revenue attribution</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {attribution.map((a) => (
              <Card key={a.platform} className="border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-muted-foreground">{a.platform}</p>
                <p className="font-medium">
                  Spend {formatCurrency(a.spend)} · Rev {formatCurrency(a.revenue)}
                </p>
                <p className="text-sm text-emerald-400">ROAS {formatRoas(a.roas)}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {campaignAttribution.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Campaign attribution</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Customers</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {campaignAttribution.map((row) => (
                  <tr
                    key={`${row.platform}:${row.campaign}`}
                    className="border-b border-white/5"
                  >
                    <td className="px-3 py-2 font-medium">{row.campaign}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.platform}</td>
                    <td className="px-3 py-2">{row.leads}</td>
                    <td className="px-3 py-2">{row.customers}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {branchPerf.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Branch marketing performance</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {branchPerf.map((b) => (
              <Card key={b.id} className="border-white/5 bg-white/[0.02] p-4">
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.leads} leads · {b.customers} customers · {formatCurrency(b.revenue)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

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
                  <p className="text-xs text-muted-foreground">ROAS (30d)</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Stat label="Spend" value={formatCurrency(campaign.spend)} />
              <Stat label="Reach" value={formatNumber(campaign.reach)} />
              <Stat label="Impressions" value={formatNumber(campaign.impressions)} />
              <Stat label="Frequency" value={campaign.frequency.toFixed(2)} />
              <Stat label="CTR" value={formatPercent(campaign.ctr)} />
              <Stat label="Conversions" value={String(campaign.conversions)} />
            </div>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <Card className="border-white/5 bg-white/[0.02] p-12 text-center">
            <p className="text-muted-foreground">
              {linkedName
                ? "No campaign delivery in the last 30 days. Sync again after ads run."
                : "Link a Meta ad account above to pull campaigns."}
            </p>
          </Card>
        )}
      </div>

      {adSets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Ad sets</h2>
          {adSets.slice(0, 20).map((s) => (
            <Card key={s.id} className="border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(s.spend)} · {s.leads_count} leads · CPL{" "}
                  {formatCurrency(s.cpl)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {ads.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Ads</h2>
          {ads.slice(0, 20).map((ad) => (
            <Card key={ad.id} className="border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{ad.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(ad.impressions)} imp · {formatNumber(ad.clicks)} clicks ·{" "}
                  {formatCurrency(ad.spend)}
                </p>
              </div>
            </Card>
          ))}
        </div>
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
