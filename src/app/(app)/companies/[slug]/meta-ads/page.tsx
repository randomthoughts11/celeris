import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { AdsBrainPanel } from "@/components/ads/ads-brain-panel";
import { MetaAdsExplorer } from "@/components/ads/meta-ads-explorer";
import { AdsAccountBar } from "@/components/companies/ads-account-bar";
import { Card } from "@/components/ui/card";
import { getAiInsights, getMetaAdsCampaigns } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageBrandSetup } from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { BRAIN_MODULE, brainConfigured } from "@/lib/ads/brain";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
import { getIntegration } from "@/lib/db/integrations";
import {
  listMetaAdSets,
  listMetaAds,
  getAttributionSummary,
  getCampaignAttributionSummary,
} from "@/lib/db/attribution";
import { getBranchPerformance } from "@/lib/db/branches";
import { formatCurrency, formatRoas } from "@/lib/format";

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
  const brainInsights = insights.filter((i) => i.module === BRAIN_MODULE);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = adSets.reduce((s, a) => s + a.leads_count, 0);
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active" && c.spend > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Ads</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Meta Ads</h1>
        <p className="text-muted-foreground">Last 30 days, audited ad by ad.</p>
      </div>

      <AdsAccountBar
        companyId={company.id}
        provider="meta_ads"
        agencyConnected={agencyConnected}
        linkedAccountName={linkedName}
        lastSyncedAt={metaIntegration?.last_synced_at}
        canManage={canManage}
        canSync={canSync}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="30-day spend" value={formatCurrency(totalSpend)} />
        <Stat label="Leads" value={String(totalLeads)} />
        <Stat label="Cost per lead" value={totalLeads ? formatCurrency(cpl) : "—"} />
        <Stat label="Campaigns spending" value={`${activeCampaigns} of ${campaigns.length}`} />
      </div>

      {linkedName && (
        <AdsBrainPanel
          companyId={company.id}
          insights={brainInsights}
          canApply={canSync}
          configured={brainConfigured()}
        />
      )}

      {campaigns.length > 0 ? (
        <MetaAdsExplorer campaigns={campaigns} adSets={adSets} ads={ads} />
      ) : (
        <Card className="border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {linkedName
              ? "No campaign delivery in the last 30 days. Sync again after ads run."
              : "Link a Meta ad account above to pull campaigns."}
          </p>
        </Card>
      )}

      {attribution.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Revenue attribution</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {attribution.map((a) => (
              <Card key={a.platform} className="border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{a.platform}</p>
                <p className="font-medium">
                  Spend {formatCurrency(a.spend)} · Rev {formatCurrency(a.revenue)}
                </p>
                <p className="text-sm text-emerald-600">ROAS {formatRoas(a.roas)}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {campaignAttribution.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Campaign attribution</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
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
                  <tr key={`${row.platform}:${row.campaign}`} className="border-b border-border">
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
              <Card key={b.id} className="border-border bg-card p-4">
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.leads} leads · {b.customers} customers · {formatCurrency(b.revenue)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {metaInsights.length > 0 && <AiInsightsPanel insights={metaInsights} companyId={company.id} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
}
