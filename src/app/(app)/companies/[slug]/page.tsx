import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  getAiInsights,
  getPerformanceSnapshots,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import {
  formatCurrency,
  formatPercent,
  formatRoas,
} from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyOverviewPage({ params }: PageProps) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const metrics = company.metrics;
  const [snapshots, insights] = await Promise.all([
    getPerformanceSnapshots(company.id),
    getAiInsights(company.id),
  ]);

  const revenueProgress = metrics
    ? (metrics.revenue / company.monthly_revenue_goal) * 100
    : 0;
  const leadsProgress = metrics
    ? (metrics.leads_count / company.monthly_lead_goal) * 100
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Executive Overview
        </h1>
        <p className="text-muted-foreground">
          Real-time performance for {company.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatCurrency(metrics?.revenue ?? 0)}
          subValue={`${revenueProgress.toFixed(0)}% of ${formatCurrency(company.monthly_revenue_goal)} goal`}
          trend={revenueProgress >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="Leads"
          value={String(metrics?.leads_count ?? 0)}
          subValue={`${leadsProgress.toFixed(0)}% of ${company.monthly_lead_goal} goal`}
          trend={leadsProgress >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="Conversions"
          value={String(metrics?.conversions ?? 0)}
          subValue={formatPercent(metrics?.conversion_rate ?? 0)}
        />
        <MetricCard
          label="Ad Spend"
          value={formatCurrency(metrics?.ad_spend ?? 0)}
          subValue={`${(metrics?.budget_used_percent ?? 0).toFixed(0)}% budget used`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="ROAS" value={formatRoas(metrics?.roas ?? 0)} />
        <MetricCard
          label="Cost Per Lead"
          value={formatCurrency(metrics?.cost_per_lead ?? 0)}
        />
        <MetricCard
          label="Cost Per Acquisition"
          value={formatCurrency(metrics?.cost_per_acquisition ?? 0)}
        />
        <MetricCard
          label="Conversion Rate"
          value={formatPercent(metrics?.conversion_rate ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
          <h3 className="mb-4 font-semibold">Monthly Goals</h3>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Revenue</span>
                <span>
                  {formatCurrency(metrics?.revenue ?? 0)} /{" "}
                  {formatCurrency(company.monthly_revenue_goal)}
                </span>
              </div>
              <Progress value={Math.min(revenueProgress, 100)} className="h-2" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Leads</span>
                <span>
                  {metrics?.leads_count ?? 0} / {company.monthly_lead_goal}
                </span>
              </div>
              <Progress value={Math.min(leadsProgress, 100)} className="h-2" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Budget</span>
                <span>{(metrics?.budget_used_percent ?? 0).toFixed(0)}% used</span>
              </div>
              <Progress
                value={metrics?.budget_used_percent ?? 0}
                className="h-2"
              />
            </div>
          </div>
        </Card>

        <PerformanceChart
          data={snapshots}
          title="Revenue Trend"
          dataKey="revenue"
          format="currency"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceChart
          data={snapshots}
          title="Lead Volume"
          dataKey="leads"
        />
        <PerformanceChart
          data={snapshots}
          title="ROAS Trend"
          dataKey="roas"
          format="roas"
        />
      </div>

      <AiInsightsPanel insights={insights} />
    </div>
  );
}
