import { getSql } from "./client";
import type { CompanyWithMetrics, UserRole } from "@/types";
import { slugify } from "@/lib/utils/slug";
import { toNumber } from "./client";

function mapCompany(row: Record<string, unknown>): CompanyWithMetrics {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logo_url: (row.logo_url as string) ?? null,
    website: (row.website as string) ?? null,
    industry: (row.industry as string) ?? null,
    monthly_budget: toNumber(row.monthly_budget),
    monthly_revenue_goal: toNumber(row.monthly_revenue_goal),
    monthly_lead_goal: toNumber(row.monthly_lead_goal),
    health_score: toNumber(row.health_score),
    is_active: row.is_active as boolean,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    metrics: null,
  };
}

export async function createCompany(input: {
  name: string;
  industry?: string;
  website?: string;
  monthlyBudget?: number;
  monthlyRevenueGoal?: number;
  monthlyLeadGoal?: number;
  googleCustomerId?: string;
  googleCustomerName?: string;
  metaAdAccountId?: string;
  metaAdAccountName?: string;
  createdByUserId: string;
}): Promise<CompanyWithMetrics> {
  const sql = getSql();
  let slug = slugify(input.name);
  const existing = await sql`SELECT id FROM companies WHERE slug = ${slug}`;
  if (existing.length > 0) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const rows = await sql`
    INSERT INTO companies (name, slug, industry, website, monthly_budget, monthly_revenue_goal, monthly_lead_goal)
    VALUES (
      ${input.name},
      ${slug},
      ${input.industry ?? null},
      ${input.website ?? null},
      ${input.monthlyBudget ?? 0},
      ${input.monthlyRevenueGoal ?? 0},
      ${input.monthlyLeadGoal ?? 0}
    )
    RETURNING *
  `;
  const company = mapCompany(rows[0]);

  await sql`
    INSERT INTO company_metrics (company_id) VALUES (${company.id})
  `;

  await sql`
    INSERT INTO company_members (company_id, user_id, role)
    VALUES (${company.id}, ${input.createdByUserId}, 'manager')
    ON CONFLICT DO NOTHING
  `;

  if (input.googleCustomerId) {
    await sql`
      INSERT INTO integrations (company_id, provider, is_connected, config)
      VALUES (
        ${company.id},
        'google_ads',
        true,
        ${JSON.stringify({
          customerId: input.googleCustomerId,
          customerName: input.googleCustomerName ?? input.googleCustomerId,
        })}
      )
      ON CONFLICT (company_id, provider) DO UPDATE SET
        is_connected = true,
        config = EXCLUDED.config,
        updated_at = now()
    `;
  }

  if (input.metaAdAccountId) {
    await sql`
      INSERT INTO integrations (company_id, provider, is_connected, config)
      VALUES (
        ${company.id},
        'meta_ads',
        true,
        ${JSON.stringify({
          adAccountId: input.metaAdAccountId,
          adAccountName: input.metaAdAccountName ?? input.metaAdAccountId,
        })}
      )
      ON CONFLICT (company_id, provider) DO UPDATE SET
        is_connected = true,
        config = EXCLUDED.config,
        updated_at = now()
    `;
  }

  const metricsRows = await sql`
    SELECT * FROM company_metrics WHERE company_id = ${company.id} LIMIT 1
  `;
  if (metricsRows[0]) {
    company.metrics = {
      id: metricsRows[0].id as string,
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
      updated_at: String(metricsRows[0].updated_at),
    };
  }

  return company;
}

export async function archiveCompany(companyId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE companies SET is_active = false, updated_at = now() WHERE id = ${companyId}
  `;
}

export async function updateCompany(
  companyId: string,
  input: Partial<{
    name: string;
    industry: string;
    website: string;
    monthlyBudget: number;
    monthlyRevenueGoal: number;
    monthlyLeadGoal: number;
    googleCustomerId: string;
    googleCustomerName: string;
    metaAdAccountId: string;
    metaAdAccountName: string;
  }>
): Promise<void> {
  const sql = getSql();
  if (input.name !== undefined) {
    await sql`UPDATE companies SET name = ${input.name}, updated_at = now() WHERE id = ${companyId}`;
  }
  if (input.industry !== undefined) {
    await sql`UPDATE companies SET industry = ${input.industry}, updated_at = now() WHERE id = ${companyId}`;
  }
  if (input.website !== undefined) {
    await sql`UPDATE companies SET website = ${input.website}, updated_at = now() WHERE id = ${companyId}`;
  }
  if (input.monthlyBudget !== undefined) {
    await sql`UPDATE companies SET monthly_budget = ${input.monthlyBudget}, updated_at = now() WHERE id = ${companyId}`;
  }
  if (input.monthlyRevenueGoal !== undefined) {
    await sql`UPDATE companies SET monthly_revenue_goal = ${input.monthlyRevenueGoal}, updated_at = now() WHERE id = ${companyId}`;
  }
  if (input.monthlyLeadGoal !== undefined) {
    await sql`UPDATE companies SET monthly_lead_goal = ${input.monthlyLeadGoal}, updated_at = now() WHERE id = ${companyId}`;
  }

  if (input.googleCustomerId) {
    await sql`
      INSERT INTO integrations (company_id, provider, is_connected, config)
      VALUES (
        ${companyId}, 'google_ads', true,
        ${JSON.stringify({ customerId: input.googleCustomerId, customerName: input.googleCustomerName ?? input.googleCustomerId })}
      )
      ON CONFLICT (company_id, provider) DO UPDATE SET
        is_connected = true, config = EXCLUDED.config, updated_at = now()
    `;
  }

  if (input.metaAdAccountId) {
    await sql`
      INSERT INTO integrations (company_id, provider, is_connected, config)
      VALUES (
        ${companyId}, 'meta_ads', true,
        ${JSON.stringify({ adAccountId: input.metaAdAccountId, adAccountName: input.metaAdAccountName ?? input.metaAdAccountId })}
      )
      ON CONFLICT (company_id, provider) DO UPDATE SET
        is_connected = true, config = EXCLUDED.config, updated_at = now()
    `;
  }
}

export async function addCompanyMember(
  companyId: string,
  userId: string,
  role: UserRole
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO company_members (company_id, user_id, role)
    VALUES (${companyId}, ${userId}, ${role})
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function removeCompanyMember(
  companyId: string,
  userId: string
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM company_members WHERE company_id = ${companyId} AND user_id = ${userId}
  `;
}

export async function listAllCompanyMemberships() {
  const sql = getSql();
  const rows = await sql`
    SELECT cm.id, cm.company_id, cm.user_id, cm.role,
           c.name AS company_name
    FROM company_members cm
    JOIN companies c ON c.id = cm.company_id
    WHERE c.is_active = true
    ORDER BY c.name
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    user_id: r.user_id as string,
    role: r.role as UserRole,
    company_name: r.company_name as string,
  }));
}

export async function getCompanyMembers(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT cm.id, cm.company_id, cm.user_id, cm.role,
           p.email AS user_email, p.full_name AS user_name
    FROM company_members cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.company_id = ${companyId}
    ORDER BY p.full_name
  `;
  return rows;
}
