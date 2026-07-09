import { NextResponse } from "next/server";
import { parsePrivyrCsv } from "@/lib/integrations/privyr-import";
import {
  recordSyncRun,
  upsertLeadFromExternal,
  verifyWebhookSecret,
} from "@/lib/integrations/lead-sync";
import { requireAuth } from "@/lib/auth/session";
import { canManageCompanies } from "@/lib/auth/access";

/** POST multipart CSV or JSON { csv, companyId } — manual Privyr export upload */
export async function POST(request: Request) {
  const user = await requireAuth().catch(() => null);
  const secret = request.headers.get("x-webhook-secret");
  const isWebhook = verifyWebhookSecret(secret, process.env.PRIVR_SYNC_WEBHOOK_SECRET);

  if (!user && !isWebhook) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user && !canManageCompanies(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let companyId: string;
  let csv: string;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { companyId?: string; csv?: string };
    companyId = body.companyId ?? "";
    csv = body.csv ?? "";
  } else {
    const form = await request.formData();
    companyId = String(form.get("companyId") ?? "");
    const file = form.get("file");
    csv = file instanceof File ? await file.text() : String(form.get("csv") ?? "");
  }

  if (!companyId || !csv.trim()) {
    return NextResponse.json({ error: "companyId and csv required" }, { status: 400 });
  }

  const rows = parsePrivyrCsv(csv);
  let created = 0;
  let updated = 0;

  try {
    for (const row of rows) {
      const result = await upsertLeadFromExternal({
        companyId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        source: row.source,
        notes: row.notes,
        externalId: row.externalId,
        activityTitle: row.activityTitle,
        activityDescription: row.activityDescription,
        activityType: row.activityType,
        activityAt: row.activityAt || undefined,
      });
      if (result.created) created++;
      else updated++;
    }

    await recordSyncRun({
      provider: "privyr_csv",
      companyId,
      status: "success",
      processed: rows.length,
      created,
      updated,
    });

    return NextResponse.json({ success: true, processed: rows.length, created, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    await recordSyncRun({
      provider: "privyr_csv",
      companyId,
      status: "error",
      processed: rows.length,
      created,
      updated,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
