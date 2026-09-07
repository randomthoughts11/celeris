import { getSql } from "@/lib/db/client";
import type { DashboardLayout, DashboardWidget } from "@/types";

function mapLayout(r: Record<string, unknown>): DashboardLayout {
  const widgets = Array.isArray(r.widgets)
    ? (r.widgets as DashboardWidget[])
    : typeof r.widgets === "string"
      ? (JSON.parse(r.widgets) as DashboardWidget[])
      : [];
  return {
    id: r.id as string,
    user_id: (r.user_id as string) ?? null,
    company_id: (r.company_id as string) ?? null,
    branch_id: (r.branch_id as string) ?? null,
    scope: (r.scope as string) ?? "user",
    name: (r.name as string) ?? "My Dashboard",
    widgets,
    is_default: Boolean(r.is_default),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getUserDashboard(
  userId: string,
  companyId?: string | null
): Promise<DashboardLayout | null> {
  const sql = getSql();
  if (companyId) {
    const rows = await sql`
      SELECT * FROM dashboard_layouts
      WHERE user_id = ${userId} AND company_id = ${companyId}
      ORDER BY is_default DESC, updated_at DESC
      LIMIT 1
    `;
    if (rows[0]) return mapLayout(rows[0] as Record<string, unknown>);
  }
  const rows = await sql`
    SELECT * FROM dashboard_layouts
    WHERE user_id = ${userId} AND company_id IS NULL
    ORDER BY is_default DESC, updated_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapLayout(rows[0] as Record<string, unknown>) : null;
}

export async function upsertDashboard(input: {
  userId: string;
  companyId?: string | null;
  branchId?: string | null;
  scope?: string;
  name?: string;
  widgets: DashboardWidget[];
}): Promise<string> {
  const sql = getSql();
  const existing = await getUserDashboard(input.userId, input.companyId);
  if (existing) {
    await sql`
      UPDATE dashboard_layouts
      SET widgets = ${JSON.stringify(input.widgets)}::jsonb,
          name = ${input.name ?? existing.name},
          updated_at = now()
      WHERE id = ${existing.id}
    `;
    return existing.id;
  }
  const rows = await sql`
    INSERT INTO dashboard_layouts (
      user_id, company_id, branch_id, scope, name, widgets, is_default
    ) VALUES (
      ${input.userId},
      ${input.companyId ?? null},
      ${input.branchId ?? null},
      ${input.scope ?? "user"},
      ${input.name ?? "My Dashboard"},
      ${JSON.stringify(input.widgets)}::jsonb,
      true
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "w-leads", type: "leads_count", title: "Leads", x: 0, y: 0, w: 3, h: 2 },
  { id: "w-customers", type: "customers_count", title: "Customers", x: 3, y: 0, w: 3, h: 2 },
  { id: "w-revenue", type: "revenue", title: "Revenue", x: 6, y: 0, w: 3, h: 2 },
  { id: "w-ai", type: "ai_calls", title: "AI Calls", x: 9, y: 0, w: 3, h: 2 },
  { id: "w-pipeline", type: "pipeline", title: "Pipeline", x: 0, y: 2, w: 6, h: 4 },
  { id: "w-conv", type: "conversions", title: "Conversions", x: 6, y: 2, w: 6, h: 4 },
];
