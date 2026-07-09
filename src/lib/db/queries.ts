import { getSql, toNumber } from "./client";
import type {
  AiInsight,
  CompanyMetrics,
  CompanyWithMetrics,
  GoogleAdsCampaign,
  Lead,
  LeadActivity,
  MetaAdsCampaign,
  PerformanceSnapshot,
  RingCentralCall,
  SocialMetrics,
  SocialPost,
  Task,
} from "@/types";

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

function mapMetrics(row: Record<string, unknown>): CompanyMetrics {
  return {
    id: row.id as string,
    company_id: row.company_id as string,
    revenue: toNumber(row.revenue),
    leads_count: toNumber(row.leads_count),
    conversions: toNumber(row.conversions),
    ad_spend: toNumber(row.ad_spend),
    roas: toNumber(row.roas),
    cost_per_lead: toNumber(row.cost_per_lead),
    cost_per_acquisition: toNumber(row.cost_per_acquisition),
    conversion_rate: toNumber(row.conversion_rate),
    budget_used_percent: toNumber(row.budget_used_percent),
    monthly_ad_spend: toNumber(row.monthly_ad_spend),
    active_campaigns: toNumber(row.active_campaigns),
    social_posting_status: (row.social_posting_status as string) ?? "on_track",
    updated_at: String(row.updated_at),
  };
}

export async function fetchCompanies(
  accessibleIds?: string[] | "all"
): Promise<CompanyWithMetrics[]> {
  const sql = getSql();
  const companies =
    accessibleIds === "all" || !accessibleIds
      ? await sql`SELECT * FROM companies WHERE is_active = true ORDER BY name`
      : accessibleIds.length === 0
        ? []
        : await sql`
            SELECT * FROM companies
            WHERE is_active = true AND id = ANY(${accessibleIds}::uuid[])
            ORDER BY name
          `;
  const metrics = await sql`SELECT * FROM company_metrics`;
  const metricsByCompany = new Map(
    metrics.map((m) => [m.company_id as string, mapMetrics(m)])
  );
  return companies.map((c) => ({
    ...mapCompany(c),
    metrics: metricsByCompany.get(c.id as string) ?? null,
  }));
}

export async function fetchCompanyBySlug(
  slug: string
): Promise<CompanyWithMetrics | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM companies WHERE slug = ${slug} LIMIT 1
  `;
  if (!rows[0]) return null;
  const company = mapCompany(rows[0]);
  const metricsRows = await sql`
    SELECT * FROM company_metrics WHERE company_id = ${company.id} LIMIT 1
  `;
  company.metrics = metricsRows[0] ? mapMetrics(metricsRows[0]) : null;
  return company;
}

export async function fetchCompanyById(
  id: string
): Promise<CompanyWithMetrics | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM companies WHERE id = ${id} LIMIT 1
  `;
  if (!rows[0]) return null;
  const company = mapCompany(rows[0]);
  const metricsRows = await sql`
    SELECT * FROM company_metrics WHERE company_id = ${company.id} LIMIT 1
  `;
  company.metrics = metricsRows[0] ? mapMetrics(metricsRows[0]) : null;
  return company;
}

export async function fetchPerformanceSnapshots(
  companyId: string
): Promise<PerformanceSnapshot[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM performance_snapshots
    WHERE company_id = ${companyId}
    ORDER BY snapshot_date ASC
    LIMIT 30
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    snapshot_date: String(r.snapshot_date).split("T")[0],
    revenue: toNumber(r.revenue),
    leads: toNumber(r.leads),
    conversions: toNumber(r.conversions),
    ad_spend: toNumber(r.ad_spend),
    roas: toNumber(r.roas),
  }));
}

export async function fetchAiInsights(companyId: string): Promise<AiInsight[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_insights
    WHERE company_id = ${companyId} AND is_dismissed = false
    ORDER BY created_at DESC
  `;
  return rows as unknown as AiInsight[];
}

export async function fetchGoogleAdsCampaigns(
  companyId: string
): Promise<GoogleAdsCampaign[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM google_ads_campaigns WHERE company_id = ${companyId} ORDER BY name
  `;
  return rows.map((r) => ({
    ...r,
    budget: toNumber(r.budget),
    daily_spend: toNumber(r.daily_spend),
    remaining_budget: toNumber(r.remaining_budget),
    clicks: toNumber(r.clicks),
    impressions: toNumber(r.impressions),
    ctr: toNumber(r.ctr),
    cpc: toNumber(r.cpc),
    conversions: toNumber(r.conversions),
    cost_per_conversion: toNumber(r.cost_per_conversion),
    roas: toNumber(r.roas),
    synced_at: String(r.synced_at),
  })) as GoogleAdsCampaign[];
}

export async function fetchMetaAdsCampaigns(
  companyId: string
): Promise<MetaAdsCampaign[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM meta_ads_campaigns WHERE company_id = ${companyId} ORDER BY name
  `;
  return rows.map((r) => ({
    ...r,
    reach: toNumber(r.reach),
    impressions: toNumber(r.impressions),
    frequency: toNumber(r.frequency),
    spend: toNumber(r.spend),
    conversions: toNumber(r.conversions),
    roas: toNumber(r.roas),
    budget_remaining: toNumber(r.budget_remaining),
    ctr: toNumber(r.ctr),
    health_score: toNumber(r.health_score),
    synced_at: String(r.synced_at),
  })) as MetaAdsCampaign[];
}

export async function fetchLeads(
  companyId: string,
  ownerId?: string
): Promise<Lead[]> {
  const sql = getSql();
  const rows = ownerId
    ? await sql`
        SELECT * FROM leads
        WHERE company_id = ${companyId} AND owner_id = ${ownerId}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT * FROM leads WHERE company_id = ${companyId} ORDER BY created_at DESC
      `;
  return rows as unknown as Lead[];
}

export async function fetchLeadActivities(
  leadId: string
): Promise<LeadActivity[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM lead_activities WHERE lead_id = ${leadId} ORDER BY created_at DESC
  `;
  return rows as unknown as LeadActivity[];
}

export async function fetchTasks(companyId: string): Promise<Task[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM tasks WHERE company_id = ${companyId} ORDER BY due_date ASC NULLS LAST
  `;
  return rows as unknown as Task[];
}

export async function fetchSocialPosts(companyId: string): Promise<SocialPost[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM social_posts WHERE company_id = ${companyId} ORDER BY scheduled_at ASC NULLS LAST
  `;
  return rows as unknown as SocialPost[];
}

export async function fetchSocialMetrics(
  companyId: string
): Promise<SocialMetrics[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM social_metrics WHERE company_id = ${companyId}
  `;
  return rows.map((r) => ({
    ...r,
    followers: toNumber(r.followers),
    reach: toNumber(r.reach),
    engagement: toNumber(r.engagement),
    likes: toNumber(r.likes),
    comments: toNumber(r.comments),
    shares: toNumber(r.shares),
    views: toNumber(r.views),
    saves: toNumber(r.saves),
    growth_percent: toNumber(r.growth_percent),
    recorded_at: String(r.recorded_at).split("T")[0],
  })) as SocialMetrics[];
}

export async function fetchRingCentralCalls(
  companyId: string
): Promise<RingCentralCall[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ringcentral_calls WHERE company_id = ${companyId} ORDER BY started_at DESC
  `;
  return rows.map((r) => ({
    ...r,
    duration_seconds: toNumber(r.duration_seconds),
    started_at: String(r.started_at),
    created_at: String(r.created_at),
  })) as RingCentralCall[];
}
