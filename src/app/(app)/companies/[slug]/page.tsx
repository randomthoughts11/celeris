import { notFound } from "next/navigation";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { CompanyEditDialog } from "@/components/companies/company-edit-dialog";
import { CompanyHeaderActions } from "@/components/companies/company-header-actions";
import { CompanyTasksPanel } from "@/components/dashboard/company-tasks-panel";
import { DashboardLinks } from "@/components/dashboard/dashboard-links";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  getAiInsights,
  getPerformanceSnapshots,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageCompanies } from "@/lib/auth/access";
import { getIntegration } from "@/lib/db/integrations";
import { fetchTasksWithAssignees } from "@/lib/db/tasks";
import {
  formatCurrency,
  formatPercent,
  formatRoas,
} from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyOverviewPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("overview");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const metrics = company.metrics;
  const [snapshots, insights, tasks, googleIntegration, metaIntegration] =
    await Promise.all([
      getPerformanceSnapshots(company.id),
      getAiInsights(company.id),
      fetchTasksWithAssignees(company.id),
      getIntegration(company.id, "google_ads"),
      getIntegration(company.id, "meta_ads"),
    ]);

  const googleLookerUrl =
    typeof googleIntegration?.config?.lookerEmbedUrl === "string"
      ? googleIntegration.config.lookerEmbedUrl
      : undefined;
  const metaLookerUrl =
    typeof metaIntegration?.config?.lookerEmbedUrl === "string"
      ? metaIntegration.config.lookerEmbedUrl
      : undefined;

  const leadsCount = metrics?.leads_count ?? 0;
  const revenueProgress = metrics
    ? (metrics.revenue / company.monthly_revenue_goal) * 100
    : 0;
  const leadsProgress = company.monthly_lead_goal
    ? (leadsCount / company.monthly_lead_goal) * 100
    : 0;
  const adsMetricsEmpty =
    (metrics?.ad_spend ?? 0) === 0 && (metrics?.monthly_ad_spend ?? 0) === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Executive Overview
          </h1>
          <p className="text-muted-foreground">
            Operations &amp; CRM data for {company.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageCompanies(user) && <CompanyEditDialog company={company} />}
          <CompanyHeaderActions companyId={company.id} />
        </div>
      </div>

      <DashboardLinks
        companySlug={slug}
        googleLookerUrl={googleLookerUrl}
        metaLookerUrl={metaLookerUrl}
        leadsCount={leadsCount}
        showAdsNote={adsMetricsEmpty && Boolean(googleLookerUrl || metaLookerUrl)}
      />

      <CompanyTasksPanel tasks={tasks} companySlug={slug} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Leads (CRM)"
          value={String(leadsCount)}
          subValue={`${leadsProgress.toFixed(0)}% of ${company.monthly_lead_goal} goal`}
          trend={leadsProgress >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="Conversions"
          value={String(metrics?.conversions ?? 0)}
          subValue={formatPercent(metrics?.conversion_rate ?? 0)}
        />
        <MetricCard
          label="Open tasks"
          value={String(metrics?.open_tasks ?? 0)}
          subValue="Work in progress for this brand"
        />
        <MetricCard
          label="Ad spend"
          value={
            adsMetricsEmpty && (googleLookerUrl || metaLookerUrl)
              ? "In Looker"
              : formatCurrency(metrics?.ad_spend ?? metrics?.monthly_ad_spend ?? 0)
          }
          subValue={
            adsMetricsEmpty
              ? "See Google / Meta Ads pages"
              : `${(metrics?.budget_used_percent ?? 0).toFixed(0)}% budget used`
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatCurrency(metrics?.revenue ?? 0)}
          subValue={`${revenueProgress.toFixed(0)}% of goal`}
        />
        <MetricCard label="ROAS" value={formatRoas(metrics?.roas ?? 0)} />
        <MetricCard
          label="Cost Per Lead"
          value={formatCurrency(metrics?.cost_per_lead ?? 0)}
        />
        <MetricCard
          label="Active campaigns"
          value={String(metrics?.active_campaigns ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
          <h3 className="mb-4 font-semibold">Monthly Goals</h3>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Leads</span>
                <span>
                  {leadsCount} / {company.monthly_lead_goal}
                </span>
              </div>
              <Progress value={Math.min(leadsProgress, 100)} className="h-2" />
            </div>
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

      {snapshots.length > 0 && (
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
      )}

      <AiInsightsPanel insights={insights} companyId={company.id} />
    </div>
  );
}
