import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AiInsightsPanel } from "@/components/ai/insights-panel";
import { CompanyEditDialog } from "@/components/companies/company-edit-dialog";
import { CompanyHeaderActions } from "@/components/companies/company-header-actions";
import { CompanyJumpBar } from "@/components/companies/company-jump-bar";
import { CompanyTasksPanel } from "@/components/dashboard/company-tasks-panel";
import { DashboardLinks } from "@/components/dashboard/dashboard-links";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAiInsights } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { canManageBrandSetup } from "@/lib/auth/access";
import { canViewFinancials, hasPermission } from "@/lib/rbac/permissions";
import { getIntegration } from "@/lib/db/integrations";
import { fetchTasksWithAssignees } from "@/lib/db/tasks";
import { formatCurrency, formatPercent } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyOverviewPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("overview");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const showFinancials = canViewFinancials(user.roles);
  const metrics = company.metrics;
  const [insights, tasks, googleIntegration, metaIntegration] =
    await Promise.all([
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
  const openTasks = metrics?.open_tasks ?? tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
            Brand desk
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <p className="text-muted-foreground">
            Work first. Charts live on Analytics
            {googleLookerUrl || metaLookerUrl ? " and Looker on the Ads pages." : "."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageBrandSetup(user) && <CompanyEditDialog company={company} />}
          <CompanyHeaderActions
            companyId={company.id}
            canSync={hasPermission(user.roles, "MANAGE_CAMPAIGNS")}
          />
        </div>
      </div>

      <CompanyJumpBar
        slug={slug}
        roles={user.roles}
        openTasks={openTasks}
        leadsCount={leadsCount}
      />

      <DashboardLinks
        companySlug={slug}
        googleLookerUrl={googleLookerUrl}
        metaLookerUrl={metaLookerUrl}
        leadsCount={leadsCount}
        showAdsNote={adsMetricsEmpty && Boolean(googleLookerUrl || metaLookerUrl)}
      />

      <CompanyTasksPanel
        tasks={tasks}
        companySlug={slug}
        currentUserId={user.id}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Leads in CRM"
          value={String(leadsCount)}
          subValue={`${leadsProgress.toFixed(0)}% of ${company.monthly_lead_goal} goal`}
          trend={leadsProgress >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          label="Open on the board"
          value={String(openTasks)}
          subValue="Cards still in motion"
        />
        <MetricCard
          label="Conversions"
          value={String(metrics?.conversions ?? 0)}
          subValue={formatPercent(metrics?.conversion_rate ?? 0)}
        />
        {showFinancials ? (
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
        ) : (
          <MetricCard
            label="Health"
            value={String(company.health_score)}
            subValue="Brand pulse"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
          <h3 className="mb-4 font-semibold">Monthly goals</h3>
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
            {showFinancials && (
              <>
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
              </>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
          <div>
            <h3 className="font-semibold">
              {showFinancials ? "Performance lives next door" : "Delivery, not dashboards"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {showFinancials
                ? "ROAS, spend trends, and Looker reports are on Analytics and the Ads pages — this screen stays for work."
                : "Use Board and Publish for day-to-day delivery. Financial charts are for managers and admins."}
            </p>
          </div>
          {showFinancials && (
            <Link href={`/companies/${slug}/analytics`} className="mt-6">
              <Button variant="outline" className="gap-2">
                Open analytics
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </Card>
      </div>

      <AiInsightsPanel insights={insights} companyId={company.id} />
    </div>
  );
}
