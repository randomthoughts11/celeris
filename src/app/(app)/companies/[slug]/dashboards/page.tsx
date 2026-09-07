import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getUserDashboard, DEFAULT_WIDGETS } from "@/lib/db/dashboards";
import { getSql, toNumber } from "@/lib/db/client";
import { DashboardBuilderClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyDashboardsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("dashboards");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const layout = await getUserDashboard(user.id, company.id);
  const sql = getSql();
  const [leads, customers, ai, appts] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM leads WHERE company_id = ${company.id}`,
    sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(lifetime_value),0) AS rev FROM customers WHERE company_id = ${company.id}`,
    sql`SELECT COUNT(*)::int AS n FROM ai_calls WHERE company_id = ${company.id}`,
    sql`SELECT COUNT(*)::int AS n FROM appointments WHERE company_id = ${company.id} AND status IN ('scheduled','confirmed','completed')`,
  ]);
  const openPipe = await sql`
    SELECT COUNT(*)::int AS n FROM leads
    WHERE company_id = ${company.id} AND status NOT IN ('won','lost')
  `;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand dashboards</h1>
        <p className="text-muted-foreground">
          Personalized KPI layout for this brand. Drag-free builder — add/remove widgets and save.
        </p>
      </div>
      <DashboardBuilderClient
        companyId={company.id}
        widgets={layout?.widgets ?? DEFAULT_WIDGETS}
        metrics={{
          leads: toNumber(leads[0]?.n),
          customers: toNumber(customers[0]?.n),
          revenue: toNumber(customers[0]?.rev),
          aiCalls: toNumber(ai[0]?.n),
          conversions: toNumber(appts[0]?.n),
          pipelineOpen: toNumber(openPipe[0]?.n),
        }}
      />
    </div>
  );
}
