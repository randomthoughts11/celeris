import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConversation, addMessage } from "@/lib/db/messaging";
import { getSql } from "@/lib/db/client";
import { recordConversionEvent, createAttribution } from "@/lib/db/attribution";
import { verifyWebhookSecret } from "@/lib/integrations/lead-sync";

/**
 * Website chat + conversion tracking.
 * Requires WEBSITE_CHAT_SECRET via x-website-chat-secret header or ?secret=.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.WEBSITE_CHAT_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-website-chat-secret");
  const q = req.nextUrl.searchParams.get("secret");
  return (
    verifyWebhookSecret(header, secret) || verifyWebhookSecret(q, secret)
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.WEBSITE_CHAT_SECRET) {
    return NextResponse.json(
      { error: "WEBSITE_CHAT_SECRET not configured" },
      { status: 401 }
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    type?: string;
    companySlug?: string;
    companyId?: string;
    message?: string;
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    threadId?: string;
    pageUrl?: string;
    eventType?: string;
    revenue?: number;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };

  const sql = getSql();
  let companyId = body.companyId;
  if (!companyId && body.companySlug) {
    const rows = await sql`
      SELECT id FROM companies WHERE slug = ${body.companySlug} LIMIT 1
    `;
    companyId = rows[0]?.id as string | undefined;
  }
  if (!companyId) {
    return NextResponse.json({ error: "companyId or companySlug required" }, { status: 400 });
  }

  const type = body.type ?? "chat";

  if (type === "conversion") {
    const eventId = await recordConversionEvent({
      companyId,
      eventType: body.eventType ?? "page_view",
      pageUrl: body.pageUrl,
      revenue: body.revenue ?? 0,
      metadata: {
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
      },
    });
    if (body.utmCampaign || body.utmSource) {
      await createAttribution({
        companyId,
        source: body.utmSource,
        medium: body.utmMedium,
        campaignExternalId: body.utmCampaign,
        platform: "website",
        revenueAttributed: body.revenue ?? 0,
      });
    }
    return NextResponse.json({ ok: true, eventId });
  }

  if (type === "lead") {
    const rows = await sql`
      INSERT INTO leads (company_id, first_name, email, phone, source, status, priority)
      VALUES (
        ${companyId},
        ${body.visitorName || "Website visitor"},
        ${body.visitorEmail ?? null},
        ${body.visitorPhone ?? null},
        'website_chat',
        'new',
        'medium'
      )
      RETURNING id
    `;
    const leadId = rows[0].id as string;
    try {
      const { runAutomationsForTrigger } = await import("@/lib/automations/runner");
      await runAutomationsForTrigger(companyId, "lead_created", { leadId });
    } catch {
      // ignore
    }
    if (body.utmCampaign || body.utmSource) {
      await createAttribution({
        companyId,
        leadId,
        source: body.utmSource,
        medium: body.utmMedium,
        campaignExternalId: body.utmCampaign,
        platform: "website",
      });
    }
    return NextResponse.json({ ok: true, leadId });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const conversationId = await getOrCreateConversation({
    companyId,
    channel: "website_chat",
    externalThreadId: body.threadId ?? `web-${body.visitorEmail || Date.now()}`,
    participantName: body.visitorName ?? "Visitor",
    participantHandle: body.visitorEmail ?? null,
  });
  const messageId = await addMessage({
    conversationId,
    body: body.message.trim(),
    direction: "inbound",
    senderType: "contact",
  });
  return NextResponse.json({ ok: true, conversationId, messageId });
}
