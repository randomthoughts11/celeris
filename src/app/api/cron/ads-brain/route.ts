import { NextRequest, NextResponse } from "next/server";
import { brainConfigured, runMetaBrain } from "@/lib/ads/brain";
import { authorizeCron } from "@/lib/cron";
import { getSql } from "@/lib/db/client";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  if (!brainConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

  const sql = getSql();
  const rows = await sql`
    SELECT company_id FROM integrations
    WHERE provider = 'meta_ads' AND config->>'adAccountId' IS NOT NULL
  `;
  const results: Array<{ companyId: string; decisions?: number; error?: string }> = [];
  for (const { company_id } of rows) {
    const companyId = String(company_id);
    try {
      const r = await runMetaBrain(companyId);
      results.push({ companyId, decisions: r.decisions.length });
    } catch (e) {
      results.push({ companyId, error: e instanceof Error ? e.message : "failed" });
    }
  }
  return NextResponse.json({ ok: true, results });
}
