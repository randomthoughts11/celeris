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
