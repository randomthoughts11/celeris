import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { getUserDashboard, DEFAULT_WIDGETS } from "@/lib/db/dashboards";
import { getSql, toNumber } from "@/lib/db/client";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { DashboardBuilderClient } from "@/components/vande/crm-clients";

export default async function GlobalDashboardsPage() {
  const user = await requireGlobalNavAccess("dashboards");
  const layout = await getUserDashboard(user.id);
  const access = await getAccessibleCompanyIds(user);
  const sql = getSql();

  let metrics = {
    leads: 0,
    customers: 0,
    revenue: 0,
    aiCalls: 0,
    conversions: 0,
    pipelineOpen: 0,
  };

  if (access === "all") {
    const [leads, customers, ai, appts, open] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM leads`,
      sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(lifetime_value),0) AS rev FROM customers`,
      sql`SELECT COUNT(*)::int AS n FROM ai_calls`,
      sql`SELECT COUNT(*)::int AS n FROM appointments WHERE status IN ('scheduled','confirmed','completed')`,
      sql`SELECT COUNT(*)::int AS n FROM leads WHERE status NOT IN ('won','lost')`,
    ]);
    metrics = {
      leads: toNumber(leads[0]?.n),
      customers: toNumber(customers[0]?.n),
      revenue: toNumber(customers[0]?.rev),
      aiCalls: toNumber(ai[0]?.n),
      conversions: toNumber(appts[0]?.n),
      pipelineOpen: toNumber(open[0]?.n),
    };
  } else if (access.length > 0) {
    const [leads, customers, ai, appts, open] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM leads WHERE company_id = ANY(${access}::uuid[])`,
      sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(lifetime_value),0) AS rev FROM customers WHERE company_id = ANY(${access}::uuid[])`,
      sql`SELECT COUNT(*)::int AS n FROM ai_calls WHERE company_id = ANY(${access}::uuid[])`,
      sql`SELECT COUNT(*)::int AS n FROM appointments WHERE company_id = ANY(${access}::uuid[]) AND status IN ('scheduled','confirmed','completed')`,
      sql`SELECT COUNT(*)::int AS n FROM leads WHERE company_id = ANY(${access}::uuid[]) AND status NOT IN ('won','lost')`,
    ]);
    metrics = {
      leads: toNumber(leads[0]?.n),
      customers: toNumber(customers[0]?.n),
      revenue: toNumber(customers[0]?.rev),
      aiCalls: toNumber(ai[0]?.n),
      conversions: toNumber(appts[0]?.n),
      pipelineOpen: toNumber(open[0]?.n),
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Management dashboards</h1>
        <p className="text-muted-foreground">
          Cross-brand KPIs with a simple widget layout builder.
        </p>
      </div>
      <DashboardBuilderClient
        widgets={layout?.widgets ?? DEFAULT_WIDGETS}
        metrics={metrics}
      />
    </div>
  );
}
