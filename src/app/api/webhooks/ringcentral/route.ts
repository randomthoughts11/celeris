import { NextResponse } from "next/server";
import {
  ingestRingCentralWebhook,
  mapRingCentralPayload,
} from "@/lib/integrations/ringcentral-webhook";
import { recordSyncRun } from "@/lib/integrations/lead-sync";
import { verifyCompanyWebhookToken } from "@/lib/integrations/webhook-tokens";

/**
 * Receives call logs from Zapier/Make.
 * Use the per-company token from Settings as x-webhook-secret.
 * Query: ?companyId=<uuid>
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId query param required" }, { status: 400 });
  }

  const secret = request.headers.get("x-webhook-secret");
  if (!(await verifyCompanyWebhookToken(companyId, "ringcentral_webhook", secret))) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
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
