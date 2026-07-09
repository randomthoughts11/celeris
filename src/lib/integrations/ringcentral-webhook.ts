import { randomUUID } from "crypto";
import { getSql } from "@/lib/db/client";

export async function ingestRingCentralWebhook(input: {
  companyId: string;
  externalId?: string;
  direction: "inbound" | "outbound";
  outcome: string;
  caller?: string;
  receiver?: string;
  durationSeconds?: number;
  startedAt?: string;
  recordingUrl?: string;
  notes?: string;
  leadPhone?: string;
}): Promise<void> {
  const sql = getSql();
  const externalId = input.externalId ?? `rc-${randomUUID()}`;

  let leadId: string | null = null;
  if (input.leadPhone) {
    const phoneNorm = input.leadPhone.replace(/\D/g, "");
    const rows = await sql`
      SELECT id FROM leads
      WHERE company_id = ${input.companyId}
        AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ${phoneNorm}
      LIMIT 1
    `;
    leadId = (rows[0]?.id as string) ?? null;
  }

  await sql`
    INSERT INTO ringcentral_calls (
      company_id, lead_id, external_id, direction, outcome,
      caller, receiver, duration_seconds, recording_url, notes, started_at, metadata
    ) VALUES (
      ${input.companyId},
      ${leadId},
      ${externalId},
      ${input.direction},
      ${input.outcome},
      ${input.caller ?? null},
      ${input.receiver ?? null},
      ${input.durationSeconds ?? 0},
      ${input.recordingUrl ?? null},
      ${input.notes ?? null},
      ${input.startedAt ? new Date(input.startedAt).toISOString() : new Date().toISOString()},
      ${JSON.stringify({ source: "ringcentral_zapier" })}
    )
    ON CONFLICT (company_id, external_id) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      duration_seconds = EXCLUDED.duration_seconds,
      recording_url = COALESCE(EXCLUDED.recording_url, ringcentral_calls.recording_url),
      notes = COALESCE(EXCLUDED.notes, ringcentral_calls.notes),
      metadata = ringcentral_calls.metadata || EXCLUDED.metadata
  `;

  if (leadId) {
    await sql`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, created_at)
      VALUES (
        ${leadId}, 'call',
        ${`${input.direction} call — ${input.outcome}`},
        ${input.notes ?? `Duration ${input.durationSeconds ?? 0}s (RingCentral)`},
        ${input.startedAt ? new Date(input.startedAt).toISOString() : new Date().toISOString()}
      )
    `;
    await sql`
      UPDATE leads SET last_contact_at = now(), updated_at = now() WHERE id = ${leadId}
    `;
  }
}

/** Map Zapier / Make RingCentral "New Call Log" payload fields */
export function mapRingCentralPayload(body: Record<string, unknown>) {
  const directionRaw = String(body.direction ?? body.callDirection ?? "Inbound").toLowerCase();
  const direction = directionRaw.includes("out") ? "outbound" : "inbound";
  const result = String(body.result ?? body.callResult ?? body.outcome ?? "unknown").toLowerCase();

  const outcome =
    result.includes("miss") ? "missed"
    : result.includes("voice") ? "voicemail"
    : result.includes("accept") || result.includes("answer") ? "answered"
    : result.includes("busy") ? "busy"
    : "unknown";

  const from = String(body.from ?? body.fromNumber ?? body.caller ?? "");
  const to = String(body.to ?? body.toNumber ?? body.receiver ?? "");

  return {
    externalId: String(body.id ?? body.sessionId ?? body.callId ?? ""),
    direction: direction as "inbound" | "outbound",
    outcome,
    caller: direction === "inbound" ? from : to,
    receiver: direction === "inbound" ? to : from,
    durationSeconds: Number(body.duration ?? body.durationSeconds ?? 0),
    startedAt: String(body.startTime ?? body.startedAt ?? body.date ?? ""),
    recordingUrl: String(body.recordingUrl ?? body.recording ?? "") || undefined,
    notes: String(body.subject ?? body.summary ?? "") || undefined,
    leadPhone: direction === "inbound" ? from : to,
  };
}
