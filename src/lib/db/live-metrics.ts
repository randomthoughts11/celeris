import { getSql } from "./client";
import type { CompanyMetrics, CompanyWithMetrics } from "@/types";

/** Overlay CRM-sourced counts onto cached company_metrics rows. */
export async function overlayLiveMetrics(
  companies: CompanyWithMetrics[]
): Promise<CompanyWithMetrics[]> {
  if (companies.length === 0) return companies;

  const sql = getSql();
  const ids = companies.map((c) => c.id);

  const [leadStats, taskStats] = await Promise.all([
    sql`
      SELECT company_id,
        COUNT(*)::int AS leads_count,
        COUNT(*) FILTER (WHERE status = 'won')::int AS conversions
      FROM leads
      WHERE company_id = ANY(${ids}::uuid[])
      GROUP BY company_id
    `,
    sql`
      SELECT company_id,
        COUNT(*) FILTER (WHERE status NOT IN ('done', 'cancelled'))::int AS open_tasks
      FROM tasks
      WHERE company_id = ANY(${ids}::uuid[])
      GROUP BY company_id
    `,
  ]);

  const leadsByCompany = new Map(
    leadStats.map((r) => [r.company_id as string, r])
  );
  const tasksByCompany = new Map(
    taskStats.map((r) => [r.company_id as string, Number(r.open_tasks ?? 0)])
  );

  return companies.map((company) => {
    const leadRow = leadsByCompany.get(company.id);
    const openTasks = tasksByCompany.get(company.id) ?? 0;
    const leadsCount = leadRow ? Number(leadRow.leads_count) : 0;
    const conversions = leadRow ? Number(leadRow.conversions) : 0;
    const conversionRate =
      leadsCount > 0 ? (conversions / leadsCount) * 100 : 0;

    const budgetUsed =
      company.monthly_budget > 0 && company.metrics
        ? Math.min(
            100,
            (company.metrics.monthly_ad_spend / company.monthly_budget) * 100
          )
        : (company.metrics?.budget_used_percent ?? 0);

    const base: CompanyMetrics = company.metrics ?? {
      id: "",
      company_id: company.id,
      revenue: 0,
      leads_count: 0,
      conversions: 0,
      ad_spend: 0,
      roas: 0,
      cost_per_lead: 0,
      cost_per_acquisition: 0,
      conversion_rate: 0,
      budget_used_percent: 0,
      monthly_ad_spend: 0,
      active_campaigns: 0,
      social_posting_status: "on_track",
      updated_at: new Date().toISOString(),
    };

    return {
      ...company,
      metrics: {
        ...base,
        leads_count: leadsCount,
        conversions,
        conversion_rate: conversionRate,
        budget_used_percent: budgetUsed,
        open_tasks: openTasks,
      },
    };
  });
}
