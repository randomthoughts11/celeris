import { getSql, toNumber } from "@/lib/db/client";
import type { AiCall, AiCallStatus } from "@/types";

function mapCall(r: Record<string, unknown>): AiCall {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    lead_id: (r.lead_id as string) ?? null,
    customer_id: (r.customer_id as string) ?? null,
    direction: r.direction as "inbound" | "outbound",
    status: r.status as AiCallStatus,
    phone_number: (r.phone_number as string) ?? null,
    agent_id: (r.agent_id as string) ?? null,
    conversation_id: (r.conversation_id as string) ?? null,
    duration_seconds: toNumber(r.duration_seconds),
    recording_url: (r.recording_url as string) ?? null,
    transcript: (r.transcript as string) ?? null,
    summary: (r.summary as string) ?? null,
    score: r.score != null ? toNumber(r.score) : null,
    sentiment: (r.sentiment as string) ?? null,
    objections: (r.objections as unknown[]) ?? [],
    transferred_to: (r.transferred_to as string) ?? null,
    transferred_at: r.transferred_at ? String(r.transferred_at) : null,
    analysis: (r.analysis as Record<string, unknown>) ?? {},
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    started_at: r.started_at ? String(r.started_at) : null,
    ended_at: r.ended_at ? String(r.ended_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listAiCalls(
  companyId: string,
  limit = 100
): Promise<AiCall[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_calls
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => mapCall(r as Record<string, unknown>));
}

export async function listAllAiCalls(limit = 200): Promise<AiCall[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ai_calls
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => mapCall(r as Record<string, unknown>));
}

export async function createAiCall(input: {
  companyId: string;
  leadId?: string | null;
  phoneNumber?: string | null;
  direction?: "inbound" | "outbound";
  agentId?: string | null;
  conversationId?: string | null;
  status?: AiCallStatus;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO ai_calls (
      company_id, lead_id, phone_number, direction, agent_id,
      conversation_id, status, metadata, started_at
    ) VALUES (
      ${input.companyId},
      ${input.leadId ?? null},
      ${input.phoneNumber ?? null},
      ${input.direction ?? "outbound"},
      ${input.agentId ?? null},
      ${input.conversationId ?? null},
      ${input.status ?? "queued"},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      now()
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function updateAiCallByConversation(
  conversationId: string,
  patch: Partial<{
    status: AiCallStatus;
    transcript: string;
    summary: string;
    score: number;
    sentiment: string;
    recording_url: string;
    duration_seconds: number;
    analysis: Record<string, unknown>;
    objections: unknown[];
  }>
): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM ai_calls WHERE conversation_id = ${conversationId} LIMIT 1
  `;
  if (!rows[0]) return;
  const id = rows[0].id as string;

  if (patch.status !== undefined) {
    await sql`UPDATE ai_calls SET status = ${patch.status}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.transcript !== undefined) {
    await sql`UPDATE ai_calls SET transcript = ${patch.transcript}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.summary !== undefined) {
    await sql`UPDATE ai_calls SET summary = ${patch.summary}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.score !== undefined) {
    await sql`UPDATE ai_calls SET score = ${patch.score}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.sentiment !== undefined) {
    await sql`UPDATE ai_calls SET sentiment = ${patch.sentiment}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.recording_url !== undefined) {
    await sql`UPDATE ai_calls SET recording_url = ${patch.recording_url}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.duration_seconds !== undefined) {
    await sql`UPDATE ai_calls SET duration_seconds = ${patch.duration_seconds}, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.analysis !== undefined) {
    await sql`UPDATE ai_calls SET analysis = ${JSON.stringify(patch.analysis)}::jsonb, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.objections !== undefined) {
    await sql`UPDATE ai_calls SET objections = ${JSON.stringify(patch.objections)}::jsonb, updated_at = now() WHERE id = ${id}`;
  }
  if (patch.status === "completed" || patch.status === "failed" || patch.status === "transferred") {
    await sql`UPDATE ai_calls SET ended_at = now(), updated_at = now() WHERE id = ${id}`;
  }
}

export async function transferAiCall(
  callId: string,
  companyId: string,
  userId: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE ai_calls
    SET status = 'transferred', transferred_to = ${userId},
        transferred_at = now(), updated_at = now()
    WHERE id = ${callId} AND company_id = ${companyId}
  `;
}

export async function getAiCallPerformance() {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'transferred')::int AS transferred,
      COALESCE(AVG(score), 0) AS avg_score,
      COALESCE(AVG(duration_seconds), 0) AS avg_duration
    FROM ai_calls
    WHERE created_at > now() - interval '30 days'
  `;
  const r = rows[0] ?? {};
  return {
    total: toNumber(r.total),
    completed: toNumber(r.completed),
    transferred: toNumber(r.transferred),
    avgScore: toNumber(r.avg_score),
    avgDuration: toNumber(r.avg_duration),
  };
}
