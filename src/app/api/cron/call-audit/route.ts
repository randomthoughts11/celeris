import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { runCallAudit } from "@/lib/call-audit/run";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const { runId, report } = await runCallAudit();
  return NextResponse.json({ ok: true, runId, totals: report.totals, inconclusive: report.inconclusive ?? null });
}
