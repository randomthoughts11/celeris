import { getSql, toNumber } from "@/lib/db/client";
import type { Branch } from "@/types";

function mapBranch(r: Record<string, unknown>): Branch {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    name: r.name as string,
    code: (r.code as string) ?? null,
    address: (r.address as string) ?? null,
    city: (r.city as string) ?? null,
    state: (r.state as string) ?? null,
    country: (r.country as string) ?? null,
    phone: (r.phone as string) ?? null,
    timezone: (r.timezone as string) ?? null,
    is_active: Boolean(r.is_active),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listBranches(companyId: string): Promise<Branch[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM branches
    WHERE company_id = ${companyId}
    ORDER BY name ASC
  `;
  return rows.map((r) => mapBranch(r as Record<string, unknown>));
}

export async function createBranch(input: {
  companyId: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO branches (company_id, name, code, address, city, phone)
    VALUES (
      ${input.companyId},
      ${input.name},
      ${input.code ?? null},
      ${input.address ?? null},
      ${input.city ?? null},
      ${input.phone ?? null}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function updateBranch(
  branchId: string,
  companyId: string,
  patch: Partial<{
    name: string;
    code: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    is_active: boolean;
  }>
): Promise<void> {
  const sql = getSql();
  if (patch.name !== undefined) {
    await sql`UPDATE branches SET name = ${patch.name}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
  if (patch.code !== undefined) {
    await sql`UPDATE branches SET code = ${patch.code}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
  if (patch.address !== undefined) {
    await sql`UPDATE branches SET address = ${patch.address}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
  if (patch.city !== undefined) {
    await sql`UPDATE branches SET city = ${patch.city}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
  if (patch.phone !== undefined) {
    await sql`UPDATE branches SET phone = ${patch.phone}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
  if (patch.is_active !== undefined) {
    await sql`UPDATE branches SET is_active = ${patch.is_active}, updated_at = now() WHERE id = ${branchId} AND company_id = ${companyId}`;
  }
}

export async function getBranchPerformance(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      b.id,
      b.name,
      COUNT(DISTINCT l.id)::int AS leads,
      COUNT(DISTINCT c.id)::int AS customers,
      COALESCE(SUM(c.lifetime_value), 0) AS revenue
    FROM branches b
    LEFT JOIN leads l ON l.branch_id = b.id
    LEFT JOIN customers c ON c.branch_id = b.id
    WHERE b.company_id = ${companyId}
    GROUP BY b.id, b.name
    ORDER BY b.name
  `;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    leads: toNumber(r.leads),
    customers: toNumber(r.customers),
    revenue: toNumber(r.revenue),
  }));
}
