import { NextResponse } from "next/server";
import {
  ingestRingCentralWebhook,
  mapRingCentralPayload,
} from "@/lib/integrations/ringcentral-webhook";
import { recordSyncRun, verifyWebhookSecret } from "@/lib/integrations/lead-sync";

/**
 * Receives call logs from Zapier/Make RingCentral trigger.
 * Set RINGCENTRAL_WEBHOOK_SECRET on Vercel; pass as x-webhook-secret header.
 * Query: ?companyId=<uuid>
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (!verifyWebhookSecret(secret, process.env.RINGCENTRAL_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query param required" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  try {
    const mapped = mapRingCentralPayload(body);
    await ingestRingCentralWebhook({ companyId, ...mapped });
    await recordSyncRun({
      provider: "ringcentral_webhook",
      companyId,
      status: "success",
      processed: 1,
      created: 1,
      updated: 0,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook failed";
    await recordSyncRun({
      provider: "ringcentral_webhook",
      companyId,
      status: "error",
      processed: 1,
      created: 0,
      updated: 0,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
