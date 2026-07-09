import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Card } from "@/components/ui/card";
import {
  getAiInsights,
  getGoogleAdsCampaigns,
  getMetaAdsCampaigns,
  getPerformanceSnapshots,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { formatCurrency, formatRoas } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AnalyticsPage({ params }: PageProps) {
  await requireCompanyPageAccess("analytics");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const metrics = company.metrics;
  const [snapshots, googleCampaigns, metaCampaigns, insights] =
    await Promise.all([
      getPerformanceSnapshots(company.id),
      getGoogleAdsCampaigns(company.id),
      getMetaAdsCampaigns(company.id),
      getAiInsights(company.id),
    ]);

  const allCampaigns = [
    ...googleCampaigns.map((c) => ({ name: c.name, roas: c.roas, spend: c.daily_spend })),
    ...metaCampaigns.map((c) => ({ name: c.name, roas: c.roas, spend: c.spend })),
  ];
  const topCampaign = allCampaigns.sort((a, b) => b.roas - a.roas)[0];
  const worstCampaign = allCampaigns.sort((a, b) => a.roas - b.roas)[0];

  const budgetInsights = insights.filter(
    (i) => i.module === "budget" || i.module === "analytics"
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Marketing Analytics
        </h1>
        <p className="text-muted-foreground">
          Cross-channel performance and forecasting
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Monthly Spend</p>
          <p className="text-2xl font-semibold">
            {formatCurrency(metrics?.monthly_ad_spend ?? 0)}
          </p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Budget Remaining</p>
          <p className="text-2xl font-semibold">
            {formatCurrency(
              (company.monthly_budget ?? 0) - (metrics?.monthly_ad_spend ?? 0)
            )}
          </p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Blended ROAS</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {formatRoas(metrics?.roas ?? 0)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {topCampaign && (
          <Card className="border-emerald-500/20 bg-emerald-500/5 p-6">
            <p className="text-sm text-emerald-400">Top Performing Campaign</p>
            <p className="mt-1 text-lg font-semibold">{topCampaign.name}</p>
            <p className="text-muted-foreground">
              {formatRoas(topCampaign.roas)} ROAS ·{" "}
              {formatCurrency(topCampaign.spend)} spend
            </p>
          </Card>
        )}
        {worstCampaign && (
          <Card className="border-red-500/20 bg-red-500/5 p-6">
            <p className="text-sm text-red-400">Needs Attention</p>
            <p className="mt-1 text-lg font-semibold">{worstCampaign.name}</p>
            <p className="text-muted-foreground">
              {formatRoas(worstCampaign.roas)} ROAS · Consider pausing or
              optimizing
            </p>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceChart
          data={snapshots}
          title="Ad Spend Trend"
          dataKey="ad_spend"
          format="currency"
        />
        <PerformanceChart
          data={snapshots}
          title="Conversion Trend"
          dataKey="conversions"
        />
      </div>

      {budgetInsights.length > 0 && (
        <AiInsightsPanel insights={budgetInsights} companyId={company.id} />
      )}
    </div>
  );
}
