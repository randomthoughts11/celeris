import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/integrations/lead-sync";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyWebhookSecret(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
