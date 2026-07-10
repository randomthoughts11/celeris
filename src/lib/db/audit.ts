import { getSql } from "./client";

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  company_id: string | null;
  company_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export async function logAudit(input: {
  userId: string;
  companyId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO audit_logs (
      user_id, company_id, action, resource_type, resource_id, old_values, new_values
    ) VALUES (
      ${input.userId},
      ${input.companyId ?? null},
      ${input.action},
      ${input.resourceType},
      ${input.resourceId ?? null},
      ${input.oldValues ? JSON.stringify(input.oldValues) : null},
      ${input.newValues ? JSON.stringify(input.newValues) : null}
    )
  `;
}

export async function fetchRecentAuditLogs(
  limit = 50,
  companyIds?: string[] | "all"
): Promise<AuditLogEntry[]> {
  const sql = getSql();
  const rows =
    companyIds === "all" || !companyIds
      ? await sql`
          SELECT a.*,
            p.full_name AS user_name,
            c.name AS company_name
          FROM audit_logs a
          LEFT JOIN profiles p ON p.id = a.user_id
          LEFT JOIN companies c ON c.id = a.company_id
          ORDER BY a.created_at DESC
          LIMIT ${limit}
        `
      : companyIds.length === 0
        ? []
        : await sql`
            SELECT a.*,
              p.full_name AS user_name,
              c.name AS company_name
            FROM audit_logs a
            LEFT JOIN profiles p ON p.id = a.user_id
            LEFT JOIN companies c ON c.id = a.company_id
            WHERE a.company_id IS NULL OR a.company_id = ANY(${companyIds}::uuid[])
            ORDER BY a.created_at DESC
            LIMIT ${limit}
          `;

  return rows.map((r) => ({
    id: r.id as string,
    user_id: (r.user_id as string) ?? null,
    user_name: (r.user_name as string) ?? null,
    company_id: (r.company_id as string) ?? null,
    company_name: (r.company_name as string) ?? null,
    action: r.action as string,
    resource_type: r.resource_type as string,
    resource_id: (r.resource_id as string) ?? null,
    old_values: (r.old_values as Record<string, unknown>) ?? null,
    new_values: (r.new_values as Record<string, unknown>) ?? null,
    created_at: String(r.created_at),
  }));
}
