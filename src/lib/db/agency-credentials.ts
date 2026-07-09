import { getSql } from "./client";
import { encrypt, decrypt } from "@/lib/crypto";

export interface AgencyCredentialRow {
  provider: string;
  credentials_encrypted: string;
  config: Record<string, unknown>;
}

export async function getAgencyCredential(
  provider: string
): Promise<AgencyCredentialRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT provider, credentials_encrypted, config
    FROM agency_credentials WHERE provider = ${provider} LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    provider: rows[0].provider as string,
    credentials_encrypted: rows[0].credentials_encrypted as string,
    config: (rows[0].config as Record<string, unknown>) ?? {},
  };
}

export async function upsertAgencyCredential(input: {
  provider: string;
  credentials: Record<string, unknown>;
  config?: Record<string, unknown>;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO agency_credentials (provider, credentials_encrypted, config)
    VALUES (
      ${input.provider},
      ${encrypt(JSON.stringify(input.credentials))},
      ${JSON.stringify(input.config ?? {})}
    )
    ON CONFLICT (provider) DO UPDATE SET
      credentials_encrypted = EXCLUDED.credentials_encrypted,
      config = agency_credentials.config || EXCLUDED.config,
      updated_at = now()
  `;
}

export async function getAgencyTokens<T extends Record<string, unknown>>(
  provider: string
): Promise<T | null> {
  const row = await getAgencyCredential(provider);
  if (!row) return null;
  return JSON.parse(decrypt(row.credentials_encrypted)) as T;
}

export async function deleteAgencyCredential(provider: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM agency_credentials WHERE provider = ${provider}`;
}

export async function isAgencyConnected(provider: string): Promise<boolean> {
  const row = await getAgencyCredential(provider);
  return Boolean(row?.credentials_encrypted);
}
