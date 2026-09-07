import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConversation, addMessage } from "@/lib/db/messaging";
import { getSql } from "@/lib/db/client";
import { verifyWebhookSecret } from "@/lib/integrations/lead-sync";

/** Resend (or compatible) inbound email webhook → conversations. */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 401 }
    );
  }

  const header =
    req.headers.get("authorization") ||
    req.headers.get("x-resend-signature") ||
    req.headers.get("svix-signature");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7).trim()
    : header?.trim() ?? null;
  // ponytail: Bearer / exact header match; full Svix HMAC when signing payload verification is needed
  if (!verifyWebhookSecret(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    type?: string;
    data?: {
      from?: string;
      to?: string[] | string;
      subject?: string;
      text?: string;
      html?: string;
      email_id?: string;
    };
    companySlug?: string;
    companyId?: string;
  };

  const data = body.data ?? (body as unknown as NonNullable<typeof body.data>);
  const from = data?.from ?? "";
  const subject = data?.subject ?? "(no subject)";
  const text = data?.text || data?.html?.replace(/<[^>]+>/g, " ") || "";
  if (!text && !from) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const sql = getSql();
  let companyId = body.companyId;
  let leadId: string | null = null;

  if (!companyId && body.companySlug) {
    const rows = await sql`
      SELECT id FROM companies WHERE slug = ${body.companySlug} LIMIT 1
    `;
    companyId = rows[0]?.id as string | undefined;
  }
  if (!companyId && from) {
    const leads = await sql`
      SELECT company_id, id FROM leads
      WHERE email IS NOT NULL AND lower(email) = ${from.toLowerCase()}
      ORDER BY updated_at DESC LIMIT 1
    `;
    companyId = leads[0]?.company_id as string | undefined;
    leadId = (leads[0]?.id as string) ?? null;
  }

  if (!companyId) {
    return NextResponse.json({ error: "No company match" }, { status: 404 });
  }

  const conversationId = await getOrCreateConversation({
    companyId,
    channel: "email",
    externalThreadId: data?.email_id ?? `email:${from}:${subject}`,
    participantName: from,
    participantHandle: from,
    subject,
    leadId,
  });
  await addMessage({
    conversationId,
    body: text.slice(0, 20000),
    direction: "inbound",
    senderType: "contact",
    externalId: data?.email_id ?? null,
  });

  return NextResponse.json({ ok: true, conversationId });
}
