import { getSql, toNumber } from "@/lib/db/client";
import type { AttributionLink, MetaAd, MetaAdSet } from "@/types";

export async function createAttribution(input: {
  companyId: string;
  leadId?: string | null;
  customerId?: string | null;
  appointmentId?: string | null;
  branchId?: string | null;
  source?: string | null;
  medium?: string | null;
  campaignExternalId?: string | null;
  adSetExternalId?: string | null;
  adExternalId?: string | null;
  platform?: string | null;
  spendAttributed?: number;
  revenueAttributed?: number;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO attribution_links (
      company_id, branch_id, lead_id, customer_id, appointment_id,
      source, medium, campaign_external_id, ad_set_external_id, ad_external_id,
      platform, spend_attributed, revenue_attributed
    ) VALUES (
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.leadId ?? null},
      ${input.customerId ?? null},
      ${input.appointmentId ?? null},
      ${input.source ?? null},
      ${input.medium ?? null},
      ${input.campaignExternalId ?? null},
      ${input.adSetExternalId ?? null},
      ${input.adExternalId ?? null},
      ${input.platform ?? null},
      ${input.spendAttributed ?? 0},
      ${input.revenueAttributed ?? 0}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function listAttribution(companyId: string): Promise<AttributionLink[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM attribution_links
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    lead_id: (r.lead_id as string) ?? null,
    customer_id: (r.customer_id as string) ?? null,
    appointment_id: (r.appointment_id as string) ?? null,
    source: (r.source as string) ?? null,
    medium: (r.medium as string) ?? null,
    campaign_external_id: (r.campaign_external_id as string) ?? null,
    ad_set_external_id: (r.ad_set_external_id as string) ?? null,
    ad_external_id: (r.ad_external_id as string) ?? null,
    platform: (r.platform as string) ?? null,
    spend_attributed: toNumber(r.spend_attributed),
    revenue_attributed: toNumber(r.revenue_attributed),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  }));
}

export async function getAttributionSummary(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COALESCE(platform, 'unknown') AS platform,
      COUNT(*)::int AS links,
      COALESCE(SUM(spend_attributed), 0) AS spend,
      COALESCE(SUM(revenue_attributed), 0) AS revenue
    FROM attribution_links
    WHERE company_id = ${companyId}
    GROUP BY platform
  `;
  return rows.map((r) => ({
    platform: r.platform as string,
    links: toNumber(r.links),
    spend: toNumber(r.spend),
    revenue: toNumber(r.revenue),
    roas: toNumber(r.spend) > 0 ? toNumber(r.revenue) / toNumber(r.spend) : 0,
  }));
}

/** Campaign → leads / customers / revenue from attribution_links. */
export async function getCampaignAttributionSummary(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COALESCE(NULLIF(campaign_external_id, ''), '(unattributed)') AS campaign,
      COALESCE(platform, 'unknown') AS platform,
      COUNT(*)::int AS links,
      COUNT(DISTINCT lead_id)::int AS leads,
      COUNT(DISTINCT customer_id)::int AS customers,
      COALESCE(SUM(revenue_attributed), 0) AS revenue
    FROM attribution_links
    WHERE company_id = ${companyId}
    GROUP BY campaign_external_id, platform
    ORDER BY COALESCE(SUM(revenue_attributed), 0) DESC, COUNT(*) DESC
    LIMIT 25
  `;
  return rows.map((r) => ({
    campaign: r.campaign as string,
    platform: r.platform as string,
    links: toNumber(r.links),
    leads: toNumber(r.leads),
    customers: toNumber(r.customers),
    revenue: toNumber(r.revenue),
  }));
}

export async function upsertMetaAdSet(input: {
  companyId: string;
  campaignId?: string | null;
  externalId: string;
  name: string;
  status?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  leadsCount?: number;
}): Promise<void> {
  const sql = getSql();
  const cpl =
    (input.leadsCount ?? 0) > 0
      ? (input.spend ?? 0) / (input.leadsCount ?? 1)
      : 0;
  await sql`
    INSERT INTO meta_ad_sets (
      company_id, campaign_id, external_id, name, status,
      spend, impressions, clicks, reach, leads_count, cpl, synced_at
    ) VALUES (
      ${input.companyId},
      ${input.campaignId ?? null},
      ${input.externalId},
      ${input.name},
      ${input.status ?? "ACTIVE"},
      ${input.spend ?? 0},
      ${input.impressions ?? 0},
      ${input.clicks ?? 0},
      ${input.reach ?? 0},
      ${input.leadsCount ?? 0},
      ${cpl},
      now()
    )
    ON CONFLICT (company_id, external_id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      spend = EXCLUDED.spend,
      impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks,
      reach = EXCLUDED.reach,
      leads_count = EXCLUDED.leads_count,
      cpl = EXCLUDED.cpl,
      campaign_id = COALESCE(EXCLUDED.campaign_id, meta_ad_sets.campaign_id),
      synced_at = now()
  `;
}

export async function upsertMetaAd(input: {
  companyId: string;
  adSetId?: string | null;
  campaignId?: string | null;
  externalId: string;
  name: string;
  status?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  leadsCount?: number;
}): Promise<void> {
  const sql = getSql();
  const cpl =
    (input.leadsCount ?? 0) > 0
      ? (input.spend ?? 0) / (input.leadsCount ?? 1)
      : 0;
  await sql`
    INSERT INTO meta_ads (
      company_id, ad_set_id, campaign_id, external_id, name, status,
      spend, impressions, clicks, reach, leads_count, cpl, synced_at
    ) VALUES (
      ${input.companyId},
      ${input.adSetId ?? null},
      ${input.campaignId ?? null},
      ${input.externalId},
      ${input.name},
      ${input.status ?? "ACTIVE"},
      ${input.spend ?? 0},
      ${input.impressions ?? 0},
      ${input.clicks ?? 0},
      ${input.reach ?? 0},
      ${input.leadsCount ?? 0},
      ${cpl},
      now()
    )
    ON CONFLICT (company_id, external_id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      spend = EXCLUDED.spend,
      impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks,
      reach = EXCLUDED.reach,
      leads_count = EXCLUDED.leads_count,
      cpl = EXCLUDED.cpl,
      ad_set_id = COALESCE(EXCLUDED.ad_set_id, meta_ads.ad_set_id),
      campaign_id = COALESCE(EXCLUDED.campaign_id, meta_ads.campaign_id),
      synced_at = now()
  `;
}

export async function listMetaAdSets(companyId: string): Promise<MetaAdSet[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM meta_ad_sets WHERE company_id = ${companyId} ORDER BY spend DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    campaign_id: (r.campaign_id as string) ?? null,
    external_id: r.external_id as string,
    name: r.name as string,
    status: (r.status as string) ?? "ACTIVE",
    spend: toNumber(r.spend),
    impressions: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    reach: toNumber(r.reach),
    leads_count: toNumber(r.leads_count),
    cpl: toNumber(r.cpl),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    synced_at: String(r.synced_at),
  }));
}

export async function listMetaAds(companyId: string): Promise<MetaAd[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM meta_ads WHERE company_id = ${companyId} ORDER BY spend DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    ad_set_id: (r.ad_set_id as string) ?? null,
    campaign_id: (r.campaign_id as string) ?? null,
    external_id: r.external_id as string,
    name: r.name as string,
    status: (r.status as string) ?? "ACTIVE",
    spend: toNumber(r.spend),
    impressions: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    reach: toNumber(r.reach),
    leads_count: toNumber(r.leads_count),
    cpl: toNumber(r.cpl),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    synced_at: String(r.synced_at),
  }));
}

export async function recordConversionEvent(input: {
  companyId: string;
  eventType: string;
  leadId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  pageUrl?: string | null;
  revenue?: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO conversion_events (
      company_id, branch_id, lead_id, customer_id, event_type, page_url, revenue, metadata
    ) VALUES (
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.leadId ?? null},
      ${input.customerId ?? null},
      ${input.eventType},
      ${input.pageUrl ?? null},
      ${input.revenue ?? 0},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id
  `;
  return rows[0].id as string;
}
