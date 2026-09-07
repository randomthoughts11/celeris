import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConversation, addMessage } from "@/lib/db/messaging";
import { getSql } from "@/lib/db/client";
import {
  verifyMetaHubSignature,
  verifyWebhookSecret,
} from "@/lib/integrations/lead-sync";

/**
 * Meta Messenger / Instagram DM webhook.
 * GET: hub challenge with META_WEBHOOK_VERIFY_TOKEN.
 * POST: requires META_APP_SECRET + valid X-Hub-Signature-256.
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const verify = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    token &&
    verify &&
    verifyWebhookSecret(token, verify)
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "META_APP_SECRET not configured" },
      { status: 401 }
    );
  }

  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaHubSignature(raw, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string };
        timestamp?: number;
      }>;
      changes?: Array<{
        field?: string;
        value?: {
          sender?: { id?: string };
          message?: { mid?: string; text?: string };
        };
      }>;
    }>;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sql = getSql();
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;
    let companyId: string | null = null;
    if (pageId) {
      const rows = await sql`
        SELECT company_id FROM social_accounts
        WHERE metadata->>'page_id' = ${pageId}
           OR metadata->>'ig_id' = ${pageId}
        LIMIT 1
      `;
      companyId = (rows[0]?.company_id as string) ?? null;
    }
    if (!companyId) continue;

    const channel =
      body.object === "instagram" ? ("instagram" as const) : ("facebook" as const);

    for (const msg of entry.messaging ?? []) {
      const text = msg.message?.text;
      if (!text) continue;
      const senderId = msg.sender?.id ?? "unknown";
      const conversationId = await getOrCreateConversation({
        companyId,
        channel,
        externalThreadId: `${pageId}:${senderId}`,
        participantHandle: senderId,
        participantName: senderId,
      });
      await addMessage({
        conversationId,
        body: text,
        direction: "inbound",
        senderType: "contact",
        externalId: msg.message?.mid ?? null,
      });
    }

    for (const change of entry.changes ?? []) {
      const text = change.value?.message?.text;
      if (!text) continue;
      const senderId = change.value?.sender?.id ?? "unknown";
      const conversationId = await getOrCreateConversation({
        companyId,
        channel: "instagram",
        externalThreadId: `${pageId}:${senderId}`,
        participantHandle: senderId,
      });
      await addMessage({
        conversationId,
        body: text,
        direction: "inbound",
        senderType: "contact",
        externalId: change.value?.message?.mid ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
