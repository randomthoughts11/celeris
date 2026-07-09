import { createHash, timingSafeEqual } from "crypto";
import { getSql } from "@/lib/db/client";

export function verifyWebhookSecret(
  provided: string | null,
  expected: string | undefined
): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function upsertLeadFromExternal(input: {
  companyId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source: string;
  notes?: string;
  externalId?: string;
  activityTitle?: string;
  activityDescription?: string;
  activityType?: string;
  activityAt?: string;
}): Promise<{ leadId: string; created: boolean }> {
  const sql = getSql();
  let leadId: string | null = null;
  let created = false;

  if (input.externalId) {
    const mapped = await sql`
      SELECT lead_id FROM privyr_client_map
      WHERE company_id = ${input.companyId} AND privyr_client_key = ${input.externalId}
      LIMIT 1
    `;
    if (mapped[0]) leadId = mapped[0].lead_id as string;
  }

  if (!leadId && input.phone) {
    const phoneNorm = normalizePhone(input.phone);
    const byPhone = await sql`
      SELECT id FROM leads
      WHERE company_id = ${input.companyId}
        AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ${phoneNorm}
      LIMIT 1
    `;
    if (byPhone[0]) leadId = byPhone[0].id as string;
  }

  if (!leadId && input.email) {
    const byEmail = await sql`
      SELECT id FROM leads WHERE company_id = ${input.companyId} AND lower(email) = lower(${input.email})
      LIMIT 1
    `;
    if (byEmail[0]) leadId = byEmail[0].id as string;
  }

  if (!leadId) {
    const rows = await sql`
      INSERT INTO leads (company_id, first_name, last_name, email, phone, source, notes, last_contact_at)
      VALUES (
        ${input.companyId},
        ${input.firstName},
        ${input.lastName ?? null},
        ${input.email ?? null},
        ${input.phone ?? null},
        ${input.source},
        ${input.notes ?? null},
        ${input.activityAt ? new Date(input.activityAt).toISOString() : null}
      )
      RETURNING id
    `;
    leadId = rows[0].id as string;
    created = true;
  } else {
    await sql`
      UPDATE leads SET
        first_name = COALESCE(NULLIF(${input.firstName}, ''), first_name),
        last_name = COALESCE(${input.lastName ?? null}, last_name),
        email = COALESCE(${input.email ?? null}, email),
        phone = COALESCE(${input.phone ?? null}, phone),
        notes = COALESCE(${input.notes ?? null}, notes),
        last_contact_at = COALESCE(${input.activityAt ? new Date(input.activityAt).toISOString() : null}, last_contact_at),
        updated_at = now()
      WHERE id = ${leadId}
    `;
  }

  if (input.externalId) {
    await sql`
      INSERT INTO privyr_client_map (company_id, privyr_client_key, lead_id, last_synced_at)
      VALUES (${input.companyId}, ${input.externalId}, ${leadId}, now())
      ON CONFLICT (company_id, privyr_client_key) DO UPDATE SET
        lead_id = EXCLUDED.lead_id,
        last_synced_at = now()
    `;
  }

  if (input.activityTitle) {
    await sql`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, created_at)
      VALUES (
        ${leadId},
        ${input.activityType ?? "note"},
        ${input.activityTitle},
        ${input.activityDescription ?? null},
        ${input.activityAt ? new Date(input.activityAt).toISOString() : new Date().toISOString()}
      )
    `;
  }

  return { leadId: leadId!, created };
}

export async function recordSyncRun(input: {
  provider: string;
  companyId?: string;
  status: string;
  processed: number;
  created: number;
  updated: number;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO sync_runs (provider, company_id, status, records_processed, records_created, records_updated, error_message, metadata, completed_at)
    VALUES (
      ${input.provider},
      ${input.companyId ?? null},
      ${input.status},
      ${input.processed},
      ${input.created},
      ${input.updated},
      ${input.error ?? null},
      ${JSON.stringify(input.metadata ?? {})},
      now()
    )
  `;
}
