import { getSql, toNumber } from "@/lib/db/client";
import type { Customer } from "@/types";

function mapCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    lead_id: (r.lead_id as string) ?? null,
    owner_id: (r.owner_id as string) ?? null,
    first_name: r.first_name as string,
    last_name: (r.last_name as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    company_name: (r.company_name as string) ?? null,
    lifetime_value: toNumber(r.lifetime_value),
    tags: (r.tags as string[]) ?? [],
    notes: (r.notes as string) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    converted_at: String(r.converted_at),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listCustomers(
  companyId: string,
  opts?: { ownerId?: string; branchId?: string }
): Promise<Customer[]> {
  const sql = getSql();
  if (opts?.ownerId && opts?.branchId) {
    const rows = await sql`
      SELECT * FROM customers
      WHERE company_id = ${companyId}
        AND owner_id = ${opts.ownerId}
        AND branch_id = ${opts.branchId}
      ORDER BY converted_at DESC
    `;
    return rows.map((r) => mapCustomer(r as Record<string, unknown>));
  }
  if (opts?.ownerId) {
    const rows = await sql`
      SELECT * FROM customers
      WHERE company_id = ${companyId} AND owner_id = ${opts.ownerId}
      ORDER BY converted_at DESC
    `;
    return rows.map((r) => mapCustomer(r as Record<string, unknown>));
  }
  if (opts?.branchId) {
    const rows = await sql`
      SELECT * FROM customers
      WHERE company_id = ${companyId} AND branch_id = ${opts.branchId}
      ORDER BY converted_at DESC
    `;
    return rows.map((r) => mapCustomer(r as Record<string, unknown>));
  }
  const rows = await sql`
    SELECT * FROM customers
    WHERE company_id = ${companyId}
    ORDER BY converted_at DESC
  `;
  return rows.map((r) => mapCustomer(r as Record<string, unknown>));
}

export async function createCustomer(input: {
  companyId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  lifetimeValue?: number;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO customers (
      company_id, branch_id, lead_id, owner_id,
      first_name, last_name, email, phone, company_name, notes, lifetime_value
    ) VALUES (
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.leadId ?? null},
      ${input.ownerId ?? null},
      ${input.firstName},
      ${input.lastName ?? null},
      ${input.email ?? null},
      ${input.phone ?? null},
      ${input.companyName ?? null},
      ${input.notes ?? null},
      ${input.lifetimeValue ?? 0}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

/** Convert a won lead into a customer (idempotent on lead_id). */
export async function convertLeadToCustomer(
  leadId: string,
  companyId: string,
  ownerId?: string | null
): Promise<string> {
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM customers WHERE lead_id = ${leadId} LIMIT 1
  `;
  if (existing[0]) return existing[0].id as string;

  const leads = await sql`
    SELECT * FROM leads WHERE id = ${leadId} AND company_id = ${companyId} LIMIT 1
  `;
  const lead = leads[0];
  if (!lead) throw new Error("Lead not found");

  const rows = await sql`
    INSERT INTO customers (
      company_id, branch_id, lead_id, owner_id,
      first_name, last_name, email, phone, company_name, notes
    ) VALUES (
      ${companyId},
      ${(lead.branch_id as string) ?? null},
      ${leadId},
      ${ownerId ?? (lead.owner_id as string) ?? null},
      ${lead.first_name as string},
      ${(lead.last_name as string) ?? null},
      ${(lead.email as string) ?? null},
      ${(lead.phone as string) ?? null},
      ${(lead.company_name as string) ?? null},
      ${(lead.notes as string) ?? null}
    )
    RETURNING id
  `;

  await sql`
    UPDATE leads SET status = 'won', updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;

  return rows[0].id as string;
}
