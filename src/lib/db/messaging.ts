import { getSql } from "@/lib/db/client";
import type { Conversation, ConversationChannel, CrmMessage } from "@/types";

function mapConv(r: Record<string, unknown>): Conversation {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    lead_id: (r.lead_id as string) ?? null,
    customer_id: (r.customer_id as string) ?? null,
    channel: r.channel as ConversationChannel,
    external_thread_id: (r.external_thread_id as string) ?? null,
    subject: (r.subject as string) ?? null,
    participant_name: (r.participant_name as string) ?? null,
    participant_handle: (r.participant_handle as string) ?? null,
    assignee_id: (r.assignee_id as string) ?? null,
    status: (r.status as string) ?? "open",
    last_message_at: r.last_message_at ? String(r.last_message_at) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapMsg(r: Record<string, unknown>): CrmMessage {
  return {
    id: r.id as string,
    conversation_id: r.conversation_id as string,
    direction: r.direction as string,
    sender_type: r.sender_type as string,
    sender_id: (r.sender_id as string) ?? null,
    body: r.body as string,
    ai_generated: Boolean(r.ai_generated),
    external_id: (r.external_id as string) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  };
}

export async function listConversations(
  companyId?: string,
  limit = 100
): Promise<Conversation[]> {
  const sql = getSql();
  if (companyId) {
    const rows = await sql`
      SELECT * FROM conversations
      WHERE company_id = ${companyId}
      ORDER BY COALESCE(last_message_at, created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => mapConv(r as Record<string, unknown>));
  }
  const rows = await sql`
    SELECT * FROM conversations
    ORDER BY COALESCE(last_message_at, created_at) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => mapConv(r as Record<string, unknown>));
}

export async function getOrCreateConversation(input: {
  companyId: string;
  channel: ConversationChannel;
  externalThreadId?: string | null;
  participantName?: string | null;
  participantHandle?: string | null;
  leadId?: string | null;
  subject?: string | null;
}): Promise<string> {
  const sql = getSql();
  if (input.externalThreadId) {
    const existing = await sql`
      SELECT id FROM conversations
      WHERE company_id = ${input.companyId}
        AND channel = ${input.channel}
        AND external_thread_id = ${input.externalThreadId}
      LIMIT 1
    `;
    if (existing[0]) return existing[0].id as string;
  }
  const rows = await sql`
    INSERT INTO conversations (
      company_id, channel, external_thread_id, participant_name,
      participant_handle, lead_id, subject, last_message_at
    ) VALUES (
      ${input.companyId},
      ${input.channel},
      ${input.externalThreadId ?? null},
      ${input.participantName ?? null},
      ${input.participantHandle ?? null},
      ${input.leadId ?? null},
      ${input.subject ?? null},
      now()
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM conversations WHERE id = ${conversationId} LIMIT 1
  `;
  if (!rows[0]) return null;
  return mapConv(rows[0] as Record<string, unknown>);
}

export async function listMessages(conversationId: string): Promise<CrmMessage[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => mapMsg(r as Record<string, unknown>));
}

export async function addMessage(input: {
  conversationId: string;
  body: string;
  direction?: string;
  senderType?: string;
  senderId?: string | null;
  aiGenerated?: boolean;
  externalId?: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO messages (
      conversation_id, direction, sender_type, sender_id, body, ai_generated, external_id
    ) VALUES (
      ${input.conversationId},
      ${input.direction ?? "outbound"},
      ${input.senderType ?? "agent"},
      ${input.senderId ?? null},
      ${input.body},
      ${input.aiGenerated ?? false},
      ${input.externalId ?? null}
    )
    RETURNING id
  `;
  await sql`
    UPDATE conversations
    SET last_message_at = now(), updated_at = now()
    WHERE id = ${input.conversationId}
  `;
  return rows[0].id as string;
}
