import { getSql } from "./client";

export interface IntegrationRow {
  id: string;
  company_id: string;
  provider: string;
  is_connected: boolean;
  credentials_encrypted: string | null;
  config: Record<string, unknown>;
  last_synced_at: string | null;
}

export async function getIntegration(
  companyId: string,
  provider: string
): Promise<IntegrationRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM integrations
    WHERE company_id = ${companyId} AND provider = ${provider}
    LIMIT 1
  `;
  return (rows[0] as IntegrationRow) ?? null;
}

export async function upsertIntegration(input: {
  companyId: string;
  provider: string;
  isConnected: boolean;
  credentialsEncrypted?: string | null;
  config?: Record<string, unknown>;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO integrations (company_id, provider, is_connected, credentials_encrypted, config)
    VALUES (
      ${input.companyId},
      ${input.provider},
      ${input.isConnected},
      ${input.credentialsEncrypted ?? null},
      ${JSON.stringify(input.config ?? {})}
    )
    ON CONFLICT (company_id, provider) DO UPDATE SET
      is_connected = EXCLUDED.is_connected,
      credentials_encrypted = COALESCE(EXCLUDED.credentials_encrypted, integrations.credentials_encrypted),
      config = integrations.config || EXCLUDED.config,
      updated_at = now()
  `;
}

export async function disconnectIntegration(
  companyId: string,
  provider: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE integrations
    SET is_connected = false, credentials_encrypted = NULL, updated_at = now()
    WHERE company_id = ${companyId} AND provider = ${provider}
  `;
}

export async function markIntegrationSynced(
  companyId: string,
  provider: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE integrations
    SET last_synced_at = now(), updated_at = now()
    WHERE company_id = ${companyId} AND provider = ${provider}
  `;
}

export async function setLookerEmbedUrl(
  companyId: string,
  provider: "meta_ads" | "google_ads",
  embedUrl: string | null
): Promise<void> {
  const existing = await getIntegration(companyId, provider);
  const config = { ...(existing?.config ?? {}) };
  if (embedUrl) config.lookerEmbedUrl = embedUrl;
  else delete config.lookerEmbedUrl;

  await upsertIntegration({
    companyId,
    provider,
    isConnected: true,
    config,
  });
}

export async function recomputeCompanyAdsMetrics(companyId: string): Promise<void> {
  const sql = getSql();
  const [google] = await sql`
    SELECT
      COALESCE(SUM(daily_spend), 0)::float AS spend,
      COALESCE(SUM(daily_spend * roas), 0)::float AS conversion_value,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active
    FROM google_ads_campaigns
    WHERE company_id = ${companyId}
  `;
  const [meta] = await sql`
    SELECT
      COALESCE(SUM(spend), 0)::float AS spend,
      COALESCE(SUM(spend * roas), 0)::float AS conversion_value,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active
    FROM meta_ads_campaigns
    WHERE company_id = ${companyId}
  `;

  const spend = Number(google?.spend ?? 0) + Number(meta?.spend ?? 0);
  const conversionValue =
    Number(google?.conversion_value ?? 0) + Number(meta?.conversion_value ?? 0);
  const active = Number(google?.active ?? 0) + Number(meta?.active ?? 0);
  const roas = spend > 0 ? conversionValue / spend : 0;

  const [leads] = await sql`
    SELECT COUNT(*)::int AS n FROM leads WHERE company_id = ${companyId}
  `;
  const leadCount = Number(leads?.n ?? 0);
  const costPerLead = leadCount > 0 ? spend / leadCount : 0;

  await sql`
    UPDATE company_metrics SET
      monthly_ad_spend = ${spend},
      ad_spend = ${spend},
      active_campaigns = ${active},
      roas = ${roas},
      cost_per_lead = ${costPerLead},
      updated_at = now()
    WHERE company_id = ${companyId}
  `;
}
